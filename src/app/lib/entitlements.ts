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
 * The rule as a PostgREST `or=` expression, for queries answering "what can
 * this client train right now". Combine with `.eq('is_active', true)`.
 *
 * Nested and/or is supported by PostgREST and was verified against this
 * project's REST endpoint before being relied on here.
 */
export function entitlementOrFilter(today: string = todayISO()): string {
  return `source.eq.assigned,and(start_date.lte.${today},or(end_date.gte.${today},end_date.is.null))`
}

export type EntitlementRow = {
  source?: string | null
  start_date?: string | null
  end_date?: string | null
  is_active?: boolean | null
}

/**
 * The same rule as a predicate, for rows already in hand.
 *
 * `includeFuture` keeps not-yet-started programs — the schedule screen shows
 * upcoming blocks on purpose, so it wants "not expired" rather than "live
 * today". Expiry still applies either way.
 */
export function isEntitled(
  row: EntitlementRow,
  opts: { today?: string; includeFuture?: boolean } = {}
): boolean {
  const today = opts.today ?? todayISO()

  if (row.is_active === false && !opts.includeFuture) return false

  // Trainer-assigned: the trainer controls access, dates are advisory.
  if (row.source !== 'purchased') return true

  // Purchased: the licence window is real.
  if (!opts.includeFuture && row.start_date && row.start_date > today) return false
  if (row.end_date && row.end_date < today) return false
  return true
}
