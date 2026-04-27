// Pascal mascot score constants and pure helpers.
// The API route does the DB work; everything here is math.

export const PASCAL_MIN = 0
export const PASCAL_MAX = 200
export const PASCAL_DEFAULT = 100
export const PASCAL_STAGES = 20
export const PASCAL_PER_STAGE = PASCAL_MAX / PASCAL_STAGES // 10

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
 * Rolling 7-day target score: how much of this week's training target
 * the user hit. 100 = on target, <100 = behind, >100 = overachieving.
 *
 * Day-agnostic: a workout completed any day in the last 7 counts —
 * mixing up which day you train doesn't punish you. New users with no
 * completions yet start at the friendly default so Pascal isn't sad
 * on day 1 before they've had a chance to start.
 */
export function computeRollingScore(params: {
  completionsLast7d: number
  sessionsPerWeek: number
  totalCompletionsEver: number
}): number {
  const { completionsLast7d, sessionsPerWeek, totalCompletionsEver } = params

  if (sessionsPerWeek === 0) return PASCAL_DEFAULT
  if (totalCompletionsEver === 0) return PASCAL_DEFAULT

  return clampScore(Math.round((completionsLast7d / sessionsPerWeek) * 100))
}
