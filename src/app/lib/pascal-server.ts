import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PASCAL_DEFAULT,
  PASCAL_MAX,
  POINTS_COMPLETED,
  POINTS_DECAY,
  POINTS_MISSED_SCHEDULED,
  clampScore,
  formatDate,
  parseDate,
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
 * Bring a user's Pascal score up to date and persist it. Correct
 * semantics (the old version had a "short-circuit if last_processed
 * is today" bug that dropped the +10 when a client completed a
 * workout after the dashboard had already loaded that day):
 *
 *   - Decay / missed-workout penalties are applied to each day in
 *     (last_processed_date, yesterday]. Today is intentionally
 *     skipped — it's still in progress.
 *   - Every workout_completion with pascal_counted = FALSE adds
 *     POINTS_COMPLETED to the score, then gets flipped to TRUE so
 *     it's never credited twice.
 *
 * Safe to call multiple times in a day. Safe to call from
 * GET /api/pascal (dashboard load) AND POST /api/workouts/complete
 * (fresh completion just landed).
 */
export async function recomputeAndPersistPascal(
  supabase: AnySupabase,
  userId: string,
  tz: string
): Promise<PascalResult> {
  const today = todayInTz(tz)
  const todayDate = parseDate(today)
  const yesterday = new Date(todayDate)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = formatDate(yesterday)

  // Load or create the Pascal row.
  const { data: existing } = await supabase
    .from('pascal_scores')
    .select('score, last_processed_date')
    .eq('user_id', userId)
    .maybeSingle()

  if (!existing) {
    const { data: inserted, error: insertError } = await supabase
      .from('pascal_scores')
      .insert({
        user_id: userId,
        score: PASCAL_DEFAULT,
        last_processed_date: yesterdayStr,
      })
      .select('score, last_processed_date')
      .single()

    if (insertError || !inserted) {
      throw new Error(`Failed to initialise pascal_scores: ${insertError?.message}`)
    }

    // Still need to credit any uncounted completions this user may have
    // (rare, but possible if the row was wiped manually).
    return creditUncountedAndFinish(supabase, userId, inserted.score, inserted.last_processed_date, todayDate)
  }

  const startingScore: number = existing.score
  const lastProcessed: string | null = existing.last_processed_date

  // Collect:
  //   1. Completion scheduled_dates inside the decay window — these
  //      are days WITHOUT a decay/missed penalty (client did something).
  //   2. All uncounted completions — each adds POINTS_COMPLETED.
  //   3. Program scheduled days-of-week for missed-workout detection.
  const windowStart = lastProcessed || yesterdayStr // for a fresh row, no past days to process

  const [windowCompletionsResult, uncountedResult, programResult] = await Promise.all([
    supabase
      .from('workout_completions')
      .select('scheduled_date')
      .eq('client_id', userId)
      .gt('scheduled_date', windowStart)
      .lte('scheduled_date', yesterdayStr),

    supabase
      .from('workout_completions')
      .select('id')
      .eq('client_id', userId)
      .eq('pascal_counted', false),

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

  const completedDatesInWindow = new Set<string>()
  for (const c of windowCompletionsResult.data || []) {
    if (c.scheduled_date) completedDatesInWindow.add(c.scheduled_date)
  }

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

  // Walk past days (last_processed, yesterday] and apply decay/missed
  // on days without completions.
  let score = startingScore
  if (lastProcessed) {
    const cursor = parseDate(lastProcessed)
    cursor.setDate(cursor.getDate() + 1)
    while (cursor <= yesterday) {
      const dateStr = formatDate(cursor)
      if (!completedDatesInWindow.has(dateStr)) {
        const dow = cursor.getDay()
        if (scheduledDays.has(dow)) {
          score += POINTS_MISSED_SCHEDULED
        } else {
          score += POINTS_DECAY
        }
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  // Credit uncounted completions — each +10, regardless of scheduled_date.
  const uncountedIds = (uncountedResult.data || []).map((r) => r.id as string)
  score += uncountedIds.length * POINTS_COMPLETED
  score = clampScore(score)

  // Persist. Flip uncounted completions in the same transaction window
  // (two queries; a small race is harmless — worst case a just-inserted
  // completion gets counted twice if the user double-taps across devices).
  await supabase
    .from('pascal_scores')
    .update({
      score,
      last_processed_date: yesterdayStr,
      last_updated: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (uncountedIds.length > 0) {
    await supabase
      .from('workout_completions')
      .update({ pascal_counted: true })
      .in('id', uncountedIds)
  }

  const stage = scoreToStage(score)
  return {
    score,
    max: PASCAL_MAX,
    stage,
    tier: stageToTier(stage),
    lastProcessedDate: yesterdayStr,
  }
}

/**
 * First-ever row path — credit any uncounted completions that might
 * already exist (edge case: row was deleted or the app is being run
 * on a fresh DB). Then return.
 */
async function creditUncountedAndFinish(
  supabase: AnySupabase,
  userId: string,
  startingScore: number,
  lastProcessedDate: string,
  todayDate: Date
): Promise<PascalResult> {
  const { data: uncounted } = await supabase
    .from('workout_completions')
    .select('id')
    .eq('client_id', userId)
    .eq('pascal_counted', false)

  const ids = (uncounted || []).map((r) => r.id as string)
  let score = startingScore + ids.length * POINTS_COMPLETED
  score = clampScore(score)

  if (ids.length > 0 || score !== startingScore) {
    await supabase
      .from('pascal_scores')
      .update({ score, last_updated: new Date().toISOString() })
      .eq('user_id', userId)
  }
  if (ids.length > 0) {
    await supabase
      .from('workout_completions')
      .update({ pascal_counted: true })
      .in('id', ids)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _todayUnused = todayDate // kept for signature compatibility

  const stage = scoreToStage(score)
  return {
    score,
    max: PASCAL_MAX,
    stage,
    tier: stageToTier(stage),
    lastProcessedDate,
  }
}
