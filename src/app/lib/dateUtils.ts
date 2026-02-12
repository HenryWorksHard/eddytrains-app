/**
 * Date utilities for consistent timezone handling
 * 
 * The app stores dates as YYYY-MM-DD strings in the database.
 * We need to ensure these are interpreted correctly regardless of server timezone.
 */

/**
 * Get today's date in YYYY-MM-DD format.
 * On server: Uses UTC (Vercel servers are UTC)
 * On client: Uses local timezone
 * 
 * For consistency, we recommend using getLocalDateString on client
 * and being aware that server dates are UTC.
 */
export function getTodayString(): string {
  const now = new Date()
  return formatDateToString(now)
}

/**
 * Format a Date to YYYY-MM-DD string in local timezone.
 * Use this on the CLIENT side to avoid UTC conversion issues.
 */
export function formatDateToString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format a Date to YYYY-MM-DD string in UTC.
 * Use this on the SERVER side for consistency.
 */
export function formatDateToStringUTC(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Parse a YYYY-MM-DD string to a Date object.
 * The date will be at midnight local time.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Get date N days ago in YYYY-MM-DD format.
 */
export function getDaysAgoString(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return formatDateToString(date)
}
