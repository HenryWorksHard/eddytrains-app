import type { SupabaseClient } from '@supabase/supabase-js'
import { deriveProgramSpan, computeAccessWindow } from './purchase-window'
import { todayISO } from './entitlements'

/**
 * Hands a catalog program to a client as a purchase.
 *
 * This is the whole "web purchase -> app access" step, and the Stripe webhook
 * will be a thin wrapper around it: resolve the buyer, call this with the slug
 * the checkout carried, done. Keeping it here (rather than inside the webhook)
 * means it can be called by hand today to comp someone a program, and it stays
 * testable without Stripe in the loop.
 *
 * The access window follows the purchase rules in lib/purchase-window: week 1
 * starts the first Monday on or after the sale, and access ends on the
 * program's last actual training day.
 */

export type GrantResult =
  | { ok: true; clientProgramId: string; start_date: string; end_date: string; alreadyHad?: boolean }
  | { ok: false; error: string }

export async function grantPurchasedProgram(
  admin: SupabaseClient,
  params: {
    clientId: string
    /** Landing-page program id, e.g. 'shoulder'. Matches programs.slug. */
    slug: string
    organizationId: string
    /** YYYY-MM-DD; defaults to today. Pass the real purchase date on replay. */
    purchaseDate?: string
  }
): Promise<GrantResult> {
  const { clientId, slug, organizationId } = params
  const purchaseDate = params.purchaseDate || todayISO()

  // Only a catalog program can be sold. A custom program has no business
  // being handed out by a checkout even if someone guesses its slug.
  const { data: program } = await admin
    .from('programs')
    .select('id, duration_weeks, program_kind')
    .eq('organization_id', organizationId)
    .eq('slug', slug)
    .eq('program_kind', 'catalog')
    .maybeSingle()

  if (!program) {
    return { ok: false, error: `No catalog program with slug "${slug}" in this organisation` }
  }

  // Idempotency: webhooks retry. If they already hold a live licence for this
  // program, hand back the existing one rather than stacking duplicates.
  const today = todayISO()
  const { data: existing } = await admin
    .from('client_programs')
    .select('id, start_date, end_date')
    .eq('client_id', clientId)
    .eq('program_id', program.id)
    .eq('source', 'purchased')
    .eq('is_active', true)
    .or(`end_date.gte.${today},end_date.is.null`)
    .maybeSingle()

  if (existing) {
    return {
      ok: true,
      clientProgramId: existing.id,
      start_date: existing.start_date,
      end_date: existing.end_date,
      alreadyHad: true,
    }
  }

  // Measure the program as authored, not as labelled — duration_weeks and the
  // real content disagree on a number of programs, and the buyer is owed the
  // content that exists.
  const { data: workouts } = await admin
    .from('program_workouts')
    .select('week_number, day_of_week, parent_workout_id')
    .eq('program_id', program.id)

  const span = deriveProgramSpan(workouts || [])
  const { start_date, end_date } = computeAccessWindow(
    purchaseDate,
    span,
    program.duration_weeks
  )

  const { data: inserted, error } = await admin
    .from('client_programs')
    .insert({
      client_id: clientId,
      program_id: program.id,
      start_date,
      end_date,
      duration_weeks: span?.lastWeek ?? program.duration_weeks ?? 4,
      is_active: true,
      source: 'purchased',
    })
    .select('id')
    .single()

  if (error || !inserted) {
    return { ok: false, error: error?.message || 'Failed to create program assignment' }
  }

  return { ok: true, clientProgramId: inserted.id, start_date, end_date }
}
