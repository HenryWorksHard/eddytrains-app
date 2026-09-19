/**
 * Single source of truth for "does this client currently have access to this
 * program?".
 *
 * Before this existed the rule was scattered across ~10 call sites and they
 * disagreed: /api/programs and /workout/today enforced `end_date`, while the
 * dashboard, log, progress, streak, Pascal and the /programs/[id] access check
 * only ever checked `is_active`. Same client, same day, different answers.
 *
 * THE RULE — deliberately keyed on `client_programs.source`:
 *
 *   source = 'assigned'  (a trainer gave them the program)
 *     `is_active` alone decides. `end_date` is the trainer's planning date,
 *     not a licence. Coached clients routinely run past it while their coach
 *     keeps working with them — 9 of Eddy's 14 live assignments were already
 *     past `end_date` when this was written, and every one of those people is
 *     still training. Auto-revoking them would be a bug, not a feature.
 *
 *   source = 'purchased' (they bought it on the landing page)
 *     `end_date` IS the licence term and is enforced. A 12-week program sold
 *     on 1 Jan stops opening on 26 Mar with no cron job, no webhook and no
 *     nightly sweep — the row simply stops matching. A null `end_date` means
 *     perpetual access.
 *
 * Trainer-facing screens (roster, client detail, the scheduler) must NOT use
 * this — they need to see expired and inactive assignments to manage them.
 */

/**
 * Today as YYYY-MM-DD. Matches the app-wide convention of
 * `new Date().toISOString().split('T')[0]`, which is UTC. Adelaide runs
 * 9.5–10.5h ahead, so an expiry lands late in the client's evening rather than
 * at local midnight. Immaterial for a multi-week licence, and consistency with
 * the rest of the codebase is worth more than the precision.
 */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * The rule as a PostgREST `or=` expression. Combine with
 * `.eq('is_active', true)`.
 *
 * Reads as: assigned, OR still inside the licence, OR licensed forever.
 *
 * Note it does NOT gate on `start_date`. A purchased program starts on the
 * first Monday after the sale (see lib/purchase-window), so someone buying on
 * a Wednesday would otherwise sit locked out for five days wondering what
 * they paid for. They get in immediately; the week clock still starts Monday,
 * because the week computation already floors a future start to week 1.
 */
export function entitlementOrFilter(today: string = todayISO()): string {
  return `source.eq.assigned,end_date.gte.${today},end_date.is.null`
}

export type EntitlementRow = {
  source?: string | null
  start_date?: string | null
  end_date?: string | null
  is_active?: boolean | null
}

/**
 * A purchased licence that has run out. Assigned programs never lapse — the
 * trainer ends those by hand.
 */
export function isExpired(row: EntitlementRow, today: string = todayISO()): boolean {
  return row.source === 'purchased' && !!row.end_date && row.end_date < today
}

/** The same rule as a predicate, for rows already in hand. */
export function isEntitled(row: EntitlementRow, today: string = todayISO()): boolean {
  if (row.is_active === false) return false
  return !isExpired(row, today)
}
