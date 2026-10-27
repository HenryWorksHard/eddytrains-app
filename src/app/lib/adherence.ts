import type { SupabaseClient } from '@supabase/supabase-js'
import { entitlementOrFilter } from './entitlements'

/**
 * Weekly adherence: how much of the programmed week the client actually did.
 *
 * Computed fresh on every call from workout_completions and the active
 * program. Nothing is persisted — the old version wrote a row to a scores
 * table on every call and never read it back, which was a cache that cached
 * nothing.
 *
 * Day-agnostic on purpose. A session completed any time in the last seven
 * days counts, so a client whose program says Mon/Wed/Fri but who trains
 * Tue/Thu/Sat is not marked down for it.
 */

export type Adherence = {
  /** Sessions completed in the last seven days. */
  completed: number
  /** Sessions the active program asks for in a week. */
  target: number
  /** completed / target as a percentage, rounded. Uncapped. */
  percent: number
}

export type AdherenceResult = Adherence | null

/** Plain language for a percentage. No character, no encouragement it has not earned. */
export function adherenceLabel(a: Adherence): string {
  if (a.completed === 0) return 'Not started'
  if (a.percent < 50) return 'Behind'
  if (a.percent < 100) return 'Building'
  if (a.percent < 150) return 'On plan'
  return 'Ahead'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any, any, any>

/**
 * Returns null when there is nothing meaningful to show — no active program,
 * or a program with no scheduled days. A percentage of a target that does not
 * exist is noise, and the dashboard renders nothing rather than a zero.
 */
export async function computeWeeklyAdherence(
  supabase: AnySupabase,
  userId: string,
): Promise<AdherenceResult> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [completions, programs] = await Promise.all([
    supabase
      .from('workout_completions')
      .select('id')
      .eq('client_id', userId)
      .gte('completed_at', sevenDaysAgo),

    supabase
      .from('client_programs')
      .select('programs ( program_workouts ( day_of_week, parent_workout_id ) )')
      .eq('client_id', userId)
      .eq('is_active', true)
      .or(entitlementOrFilter()),
  ])

  // Distinct scheduled days across active programs. A swapped-in alternative
  // workout carries parent_workout_id and is the same slot, not another one.
  const scheduledDays = new Set<number>()
  for (const cp of programs.data ?? []) {
    const raw = cp.programs as unknown
    const program = (Array.isArray(raw) ? raw[0] : raw) as {
      program_workouts?: { day_of_week: number | null; parent_workout_id: string | null }[]
    } | null
    for (const w of program?.program_workouts ?? []) {
      if (w.parent_workout_id) continue
      if (w.day_of_week !== null) scheduledDays.add(w.day_of_week)
    }
  }

  const target = scheduledDays.size
  if (target === 0) return null

  const completed = completions.data?.length ?? 0
  return { completed, target, percent: Math.round((completed / target) * 100) }
}
