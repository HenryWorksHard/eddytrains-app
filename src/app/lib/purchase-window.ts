/**
 * Works out the access window for a purchased program.
 *
 * The rules, as specified:
 *   - A program is an exercise routine that runs in weeks, so access starts on
 *     the first Monday on or after the purchase. Buy on a Monday and it starts
 *     that day; buy on a Wednesday and week 1 begins the following Monday, so
 *     nobody is short-changed a partial first week.
 *   - The licence runs for the program's full authored length.
 *   - It ends on the program's LAST EXERCISE DAY, not on a round calendar
 *     date. A 12-week Mon/Wed/Fri program ends on the Friday of week 12 —
 *     no dangling empty days after the final session.
 *
 * All arithmetic is done on YYYY-MM-DD strings via UTC dates, so it can't be
 * knocked sideways by server timezone or DST.
 */

function toUTCDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUTCDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function addDays(iso: string, days: number): string {
  const d = toUTCDate(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return fromUTCDate(d)
}

/**
 * The DB stores day_of_week in JS convention (0 = Sunday .. 6 = Saturday).
 * Training weeks run Monday-first, so Sunday is the LAST day of a week, not
 * the first. This maps to Mon=0 .. Sun=6 so "latest day" compares correctly.
 */
export function mondayOffset(dayOfWeek: number): number {
  return (dayOfWeek + 6) % 7
}

/** First Monday on or after the given date. A Monday returns itself. */
export function firstMondayOnOrAfter(iso: string): string {
  const dow = toUTCDate(iso).getUTCDay()
  return addDays(iso, (8 - dow) % 7)
}

export type ProgramWorkoutShape = {
  week_number?: number | null
  day_of_week?: number | null
  parent_workout_id?: string | null
}

export type ProgramSpan = {
  /** Last week that actually contains a scheduled session. */
  lastWeek: number
  /** Monday-offset of the last training day in that week (Mon=0 .. Sun=6). */
  lastDayOffset: number
  /** Total weeks containing at least one scheduled session. */
  scheduledWeeks: number
}

/**
 * Derives the real shape of a program from its authored workouts rather than
 * from `programs.duration_weeks` — the two disagree on a number of existing
 * programs (several 6-week ones carry content through week 8), and what a
 * buyer is owed is the content that exists.
 *
 * Finishers (`parent_workout_id` set) are skipped: they hang off a parent
 * session and share its day, so they can't extend the program.
 * Workouts with no day assigned aren't scheduled, so they can't end it either.
 */
export function deriveProgramSpan(workouts: ProgramWorkoutShape[]): ProgramSpan | null {
  const scheduled = workouts.filter(
    w => !w.parent_workout_id && w.day_of_week !== null && w.day_of_week !== undefined
  )
  if (scheduled.length === 0) return null

  const weeks = new Set<number>()
  let lastWeek = 1
  for (const w of scheduled) {
    const week = w.week_number ?? 1
    weeks.add(week)
    if (week > lastWeek) lastWeek = week
  }

  let lastDayOffset = 0
  for (const w of scheduled) {
    if ((w.week_number ?? 1) !== lastWeek) continue
    const offset = mondayOffset(w.day_of_week as number)
    if (offset > lastDayOffset) lastDayOffset = offset
  }

  return { lastWeek, lastDayOffset, scheduledWeeks: weeks.size }
}

export type AccessWindow = { start_date: string; end_date: string }

/**
 * @param purchaseDate  YYYY-MM-DD the purchase happened
 * @param span          from deriveProgramSpan; null if the program has no
 *                      scheduled sessions yet
 * @param fallbackWeeks programs.duration_weeks, used only when there's no
 *                      authored schedule to measure — the window then ends on
 *                      the Sunday closing the final week
 */
export function computeAccessWindow(
  purchaseDate: string,
  span: ProgramSpan | null,
  fallbackWeeks: number | null | undefined
): AccessWindow {
  const start_date = firstMondayOnOrAfter(purchaseDate)

  if (span) {
    const end_date = addDays(start_date, (span.lastWeek - 1) * 7 + span.lastDayOffset)
    return { start_date, end_date }
  }

  const weeks = Math.max(1, fallbackWeeks || 1)
  return { start_date, end_date: addDays(start_date, weeks * 7 - 1) }
}
