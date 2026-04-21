import { createClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  PASCAL_DEFAULT,
  replayScore,
  scoreToStage,
  stageToTier,
  todayInTz,
} from '@/app/lib/pascal'

/**
 * GET /api/pascal
 *
 * Returns the user's current Pascal score, applying any pending daily
 * deltas (decay / missed-scheduled penalties / workout bonuses) between
 * the stored watermark and today. Lazy evaluation — no cron needed.
 *
 * Accepts `?tz=IANA/Zone` so that "today" is anchored to the client's
 * local calendar, not the Vercel UTC clock.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tz = searchParams.get('tz') || 'UTC'
  const today = todayInTz(tz)

  // Current row (create on first visit)
  const { data: existing } = await supabase
    .from('pascal_scores')
    .select('score, last_processed_date, created_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existing) {
    // Brand-new user: start at PASCAL_DEFAULT, anchor watermark on today.
    const { data: inserted, error: insertError } = await supabase
      .from('pascal_scores')
      .insert({
        user_id: user.id,
        score: PASCAL_DEFAULT,
        last_processed_date: today,
      })
      .select('score, last_processed_date')
      .single()

    if (insertError || !inserted) {
      console.error('[pascal] insert error:', insertError)
      return NextResponse.json({ error: 'Failed to init score' }, { status: 500 })
    }

    const stage = scoreToStage(inserted.score)
    return NextResponse.json({
      score: inserted.score,
      max: 200,
      stage,
      tier: stageToTier(stage),
      lastProcessedDate: inserted.last_processed_date,
    })
  }

  // Short-circuit: already processed today.
  if (existing.last_processed_date === today) {
    const stage = scoreToStage(existing.score)
    return NextResponse.json({
      score: existing.score,
      max: 200,
      stage,
      tier: stageToTier(stage),
      lastProcessedDate: existing.last_processed_date,
    })
  }

  // Replay: fetch completions + scheduled days for the replay window.
  const replayStart = existing.last_processed_date || today

  const [completionsResult, programResult] = await Promise.all([
    supabase
      .from('workout_completions')
      .select('scheduled_date')
      .eq('client_id', user.id)
      .gte('scheduled_date', replayStart)
      .lte('scheduled_date', today),

    supabase
      .from('client_programs')
      .select(`
        programs (
          program_workouts (
            day_of_week,
            parent_workout_id
          )
        )
      `)
      .eq('client_id', user.id)
      .eq('is_active', true),
  ])

  const completionDates = (completionsResult.data || [])
    .map((c) => c.scheduled_date as string)
    .filter(Boolean)

  const scheduledDaysOfWeek = new Set<number>()
  for (const cp of programResult.data || []) {
    const programData = cp.programs as unknown
    const program = (Array.isArray(programData) ? programData[0] : programData) as {
      program_workouts?: {
        day_of_week: number | null
        parent_workout_id: string | null
      }[]
    } | null

    program?.program_workouts?.forEach((w) => {
      if (w.parent_workout_id) return // skip sub-workouts
      if (w.day_of_week !== null) scheduledDaysOfWeek.add(w.day_of_week)
    })
  }

  const { score: newScore, lastProcessedDate } = replayScore({
    startingScore: existing.score,
    lastProcessedDate: existing.last_processed_date,
    today,
    completionDates,
    scheduledDaysOfWeek: Array.from(scheduledDaysOfWeek),
  })

  // Persist
  const { error: updateError } = await supabase
    .from('pascal_scores')
    .update({
      score: newScore,
      last_processed_date: lastProcessedDate,
      last_updated: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[pascal] update error:', updateError)
  }

  const stage = scoreToStage(newScore)
  return NextResponse.json({
    score: newScore,
    max: 200,
    stage,
    tier: stageToTier(stage),
    lastProcessedDate,
  })
}
