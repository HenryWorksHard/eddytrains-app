import type { SupabaseClient } from '@supabase/supabase-js'
import { grantPurchasedProgram } from './grant-program'
import { sendInviteEmail } from './email'

/**
 * Turns a paid Stripe checkout into app access.
 *
 * Someone who buys a program from the website is not one of Eddy's invited
 * clients: they have paid and they have no account. So this does the whole
 * thing in one place — find them or make them, hand them the program for the
 * right window, and email them a link to set a password.
 *
 * Called from the Stripe webhook, which Stripe retries. Every step is written
 * to be safe to run twice: an existing buyer is reused rather than recreated,
 * and grantPurchasedProgram reports a repeat grant instead of duplicating it.
 */

export type FulfilResult =
  | { ok: true; clientId: string; created: boolean; start_date: string; end_date: string; alreadyHad?: boolean }
  | { ok: false; error: string }

/** `_` and `%` are wildcards in LIKE, and both are legal in an email. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&')

function randomPassword(): string {
  // Never used by the buyer — they set their own through the invite link.
  return `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2).toUpperCase()}!${Date.now().toString(36)}`
}

export async function fulfilProgramPurchase(
  admin: SupabaseClient,
  params: {
    email: string
    fullName?: string | null
    /** Landing-page program id, e.g. 'shoulder'. Matches programs.slug. */
    slug: string
    /** YYYY-MM-DD; defaults to today inside the grant. */
    purchaseDate?: string
  },
): Promise<FulfilResult> {
  const email = params.email.trim().toLowerCase()
  if (!email) return { ok: false, error: 'No email on the checkout session' }

  // The program decides the organisation, so nothing here hardcodes an org id.
  const { data: program } = await admin
    .from('programs')
    .select('organization_id')
    .eq('slug', params.slug)
    .eq('program_kind', 'catalog')
    .maybeSingle()

  if (!program?.organization_id) {
    return { ok: false, error: `No catalog program with slug "${params.slug}"` }
  }
  const organizationId = program.organization_id as string

  // ── find them, or make them ────────────────────────────────────────────
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .ilike('email', escapeLike(email))
    .maybeSingle()

  let clientId = existing?.id as string | undefined
  let created = false

  if (!clientId) {
    const fullName = params.fullName?.trim() || email.split('@')[0]

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (authError || !authUser?.user) {
      // A race with a second webhook delivery lands here. Look again before
      // giving up: the other delivery may have just created them.
      const { data: raced } = await admin
        .from('profiles').select('id').ilike('email', escapeLike(email)).maybeSingle()
      if (!raced?.id) {
        return { ok: false, error: `Could not create the buyer: ${authError?.message ?? 'unknown'}` }
      }
      clientId = raced.id
    } else {
      clientId = authUser.user.id
      created = true

      const { error: profileError } = await admin.from('profiles').upsert({
        id: clientId,
        email,
        full_name: fullName,
        role: 'client',
        // Bought from the website rather than onboarded by Eddy. This is what
        // keeps the two kinds of client apart everywhere else in the app.
        client_type: 'self_serve',
        organization_id: organizationId,
        is_active: true,
        must_change_password: true,
        password_changed: false,
        status: 'pending',
        can_access_strength: true,
      })

      if (profileError) {
        // Leave no half-made account behind.
        await admin.auth.admin.deleteUser(clientId).catch(() => {})
        return { ok: false, error: `Could not create the profile: ${profileError.message}` }
      }
    }
  }

  // ── the program itself ─────────────────────────────────────────────────
  const grant = await grantPurchasedProgram(admin, {
    clientId: clientId!,
    slug: params.slug,
    organizationId,
    purchaseDate: params.purchaseDate,
  })

  if (!grant.ok) return { ok: false, error: grant.error }

  // ── let them in ────────────────────────────────────────────────────────
  // Only a brand-new buyer needs a password link. Someone who already had an
  // account just finds the program waiting for them.
  if (created) {
    try {
      const { data: tokenRow } = await admin
        .from('invite_tokens')
        .insert({ user_id: clientId, email, created_by: null })
        .select('token')
        .single()

      if (tokenRow?.token) {
        const { data: org } = await admin
          .from('organizations').select('name').eq('id', organizationId).maybeSingle()
        await sendInviteEmail({
          email,
          fullName: params.fullName ?? null,
          token: tokenRow.token,
          trainerName: null,
          orgName: org?.name ?? 'CMPD',
        })
      }
    } catch (e) {
      // They have paid and the program is on their account. A failed email is
      // recoverable from the users list with Resend invite; failing the whole
      // webhook here would make Stripe retry a purchase that already landed.
      console.error('[purchase] access granted but the invite email failed:', e)
    }
  }

  return {
    ok: true,
    clientId: clientId!,
    created,
    start_date: grant.start_date,
    end_date: grant.end_date,
    alreadyHad: grant.alreadyHad,
  }
}
