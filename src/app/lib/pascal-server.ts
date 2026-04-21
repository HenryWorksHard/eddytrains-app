import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PASCAL_DEFAULT,
  PASCAL_MAX,
  replayScore,
  scoreToStage,
  stageToTier,
  todayInTz,
  type PascalTier,
} from './pascal'

export type PascalResult = {
  score: number
  max: number
  stage: number
  tier: PascalTier
  lastProcessedDate: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any, any, any>

/**
 * Bring a user's Pascal score up to date and persist it.
 * Used by both GET /api/pascal (lazy-update on dashboard load) and
 * POST /api/workouts/complete (instant update when a workout is logged).
 *
 * - Creates the pascal_scores row at PASCAL_DEFAULT on first call.
 * - Short-circuits when last_processed_date is already `today`.
 * - Otherwise replays day-by-day from (last_processed_date, today]
 *   applying completion / missed-scheduled / decay deltas.
 */
export async function recomputeAndPersistPascal(
  supabase: AnySupabase,
  userId: string,
  tz: string
): Promise<PascalResult> {
  const today = todayInTz(tz)

  const { data: existing } = await supabase
    .from('pascal_scores')
    .select('score, last_processed_date')
    .eq('user_id', userId)
    .maybeSingle()

  // First ever call — initialise at default, anchor on today.
  if (!existing) {
    const { data: inserted, error: insertError } = await supabase
      .from('pascal_scores')
      .insert({
        user_id: userId,
        score: PASCAL_DEFAULT,
        last_processed_date: today,
      })
      .select('score, last_processed_date')
      .single()

    if (insertError || !inserted) {
      throw new Error(`Failed to initialise pascal_scores: ${insertError?.message}`)
    }

    const stage = scoreToStage(inserted.score)
    return {
      score: inserted.score,
      max: PASCAL_MAX,
      stage,
      tier: stageToTier(stage),
      lastProcessedDate: inserted.last_processed_date,
    }
  }

  // Already processed today — return as-is.
  if (existing.last_processed_date === today) {
    const stage = scoreToStage(existing.score)
    return {
      score: existing.score,
      max: PASCAL_MAX,
      stage,
      tier: stageToTier(stage),
      lastProcessedDate: existing.last_processed_date,
    }
  }

  // Replay: gather completions + scheduled days for the window.
  const replayStart = existing.last_processed_date || today

  const [completionsResult, programResult] = await Promise.all([
    supabase
      .from('workout_completions')
      .select('scheduled_date')
      .eq('client_id', userId)
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
      .eq('client_id', userId)
      .eq('is_active', true),
  ])

  const completionDates = (completionsResult.data || [])
    .map((c: { scheduled_date: string | null }) => c.scheduled_date as string)
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
      if (w.parent_workout_id) return
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

  await supabase
    .from('pascal_scores')
    .update({
      score: newScore,
      last_processed_date: lastProcessedDate,
      last_updated: new Date().toISOString(),
    })
    .eq('user_id', userId)

  const stage = scoreToStage(newScore)
  return {
    score: newScore,
    max: PASCAL_MAX,
    stage,
    tier: stageToTier(stage),
    lastProcessedDate,
  }
}
