import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PASCAL_MAX,
  computeRollingScore,
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
  lastProcessedDate: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any, any, any>

/**
 * Recompute the user's Pascal score from a rolling 7-day window:
 *
 *   score = round((completions in last 7 days / sessions_per_week) * 100)
 *
 * Capped 0-200. Day-agnostic — completed_at is what matters, not which
 * scheduled day the workout was for. So if the program says Mon/Wed/Fri
 * but the user trains Tue/Thu/Sat, they still get full credit. Brand-
 * new users with zero history start at PASCAL_DEFAULT so the mascot
 * isn't sad before they've had a chance to begin.
 *
 * Stateless replay — safe to call from /api/pascal (dashboard load) AND
 * /api/workouts/complete (fresh completion). Each call recomputes from
 * source data, so there's no drift to manage.
 */
export async function recomputeAndPersistPascal(
  supabase: AnySupabase,
  userId: string,
  tz: string
): Promise<PascalResult> {
  const today = todayInTz(tz)

  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [completionsResult, programResult, allTimeResult] = await Promise.all([
    supabase
      .from('workout_completions')
      .select('id')
      .eq('client_id', userId)
      .gte('completed_at', sevenDaysAgoIso),

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

    supabase
      .from('workout_completions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', userId),
  ])

  const completionsLast7d = completionsResult.data?.length ?? 0
  const totalCompletionsEver = allTimeResult.count ?? 0

  const scheduledDays = new Set<number>()
  for (const cp of programResult.data || []) {
    const programData = cp.programs as unknown
    const program = (Array.isArray(programData) ? programData[0] : programData) as {
      program_workouts?: { day_of_week: number | null; parent_workout_id: string | null }[]
    } | null
    program?.program_workouts?.forEach((w) => {
      if (w.parent_workout_id) return
      if (w.day_of_week !== null) scheduledDays.add(w.day_of_week)
    })
  }

  const score = computeRollingScore({
    completionsLast7d,
    sessionsPerWeek: scheduledDays.size,
    totalCompletionsEver,
  })

  await supabase
    .from('pascal_scores')
    .upsert({
      user_id: userId,
      score,
      last_processed_date: today,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  const stage = scoreToStage(score)
  return {
    score,
    max: PASCAL_MAX,
    stage,
    tier: stageToTier(stage),
    lastProcessedDate: today,
  }
}
