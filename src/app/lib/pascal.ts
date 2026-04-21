// Pascal mascot score constants and pure helpers.
// The API route does the DB work; everything here is math.

export const PASCAL_MIN = 0
export const PASCAL_MAX = 200
export const PASCAL_DEFAULT = 100
export const PASCAL_STAGES = 20
export const PASCAL_PER_STAGE = PASCAL_MAX / PASCAL_STAGES // 10

export const POINTS_COMPLETED = 10
export const POINTS_MISSED_SCHEDULED = -15
export const POINTS_DECAY = -2

export type PascalTier = 1 | 2 | 3 | 4

/** Map score to stage 1..20. */
export function scoreToStage(score: number): number {
  const s = Math.max(PASCAL_MIN, Math.min(PASCAL_MAX, score))
  if (s === PASCAL_MAX) return PASCAL_STAGES
  return Math.floor(s / PASCAL_PER_STAGE) + 1
}

/** Group stages into 4 visual tiers (1-5, 6-10, 11-15, 16-20). */
export function stageToTier(stage: number): PascalTier {
  if (stage <= 5) return 1
  if (stage <= 10) return 2
  if (stage <= 15) return 3
  return 4
}

/** Clamp to valid range. */
export function clampScore(score: number): number {
  return Math.max(PASCAL_MIN, Math.min(PASCAL_MAX, Math.round(score)))
}

/** YYYY-MM-DD formatter in the given TZ, safe for iteration. */
export function todayInTz(tz: string): string {
  const now = new Date().toLocaleString('en-US', { timeZone: tz })
  const d = new Date(now)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** Parse YYYY-MM-DD as a local date (midnight). */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/**
 * Replay daily deltas between (lastProcessed, today] against the user's
 * completions + scheduled day-of-week set. Pure function — the caller
 * handles persistence.
 */
export function replayScore(params: {
  startingScore: number
  lastProcessedDate: string | null
  today: string
  completionDates: string[] // YYYY-MM-DD values from workout_completions.scheduled_date
  scheduledDaysOfWeek: number[] // 0=Sun .. 6=Sat; empty means "no schedule known"
}): { score: number; lastProcessedDate: string } {
  const { startingScore, lastProcessedDate, today, completionDates, scheduledDaysOfWeek } = params

  // Fresh user — anchor on today, no replay needed.
  if (!lastProcessedDate) {
    return { score: clampScore(startingScore), lastProcessedDate: today }
  }

  const endDate = parseDate(today)
  const cursor = parseDate(lastProcessedDate)
  cursor.setDate(cursor.getDate() + 1)

  if (cursor > endDate) {
    return { score: clampScore(startingScore), lastProcessedDate }
  }

  const completionsByDate = new Map<string, number>()
  for (const d of completionDates) {
    completionsByDate.set(d, (completionsByDate.get(d) || 0) + 1)
  }

  const scheduled = new Set(scheduledDaysOfWeek)
  const hasSchedule = scheduled.size > 0

  let score = startingScore

  while (cursor <= endDate) {
    const dateStr = formatDate(cursor)
    const completed = completionsByDate.get(dateStr) || 0
    const dow = cursor.getDay()

    if (completed > 0) {
      score += POINTS_COMPLETED * completed
    } else if (hasSchedule && scheduled.has(dow)) {
      // Missed a scheduled workout day
      score += POINTS_MISSED_SCHEDULED
    } else {
      // Ordinary day with no workout — slow decay
      score += POINTS_DECAY
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return { score: clampScore(score), lastProcessedDate: today }
}
