import { NextRequest, NextResponse } from 'next/server'

import { getStripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendInviteEmail } from '@/app/lib/email'

// Trainer self-serve signup. Public endpoint — no auth required.
//
// Flow:
//   1. Validate input (email + org name)
//   2. Reject if email already has an auth account
//   3. Slugify the org name, append a random suffix on collision
//   4. Create auth user with email_confirm=false (no password yet)
//   5. Create organization (trialing, 14 days, default 'starter' tier)
//   6. Create profile with role='company_admin', linked to the org
//   7. Issue invite_token + send "set your password" email via Resend
//   8. Create Stripe customer with organization_id metadata (so future
//      checkout sessions link cleanly; failure here doesn't block signup)
//   9. Return success → frontend shows "check your email" screen
//
// The trainer clicks the email link → lands on /accept-invite?token=...
// → sets their password → existing accept-invite flow upserts profile +
// signs them in → middleware routes them to /dashboard?welcome=true,
// which surfaces the 3-step onboarding banner.

const SIGNUP_TIER = 'starter'
const SIGNUP_TIER_CLIENT_LIMIT = 10
const TRIAL_DAYS = 14

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'org'
}

async function uniqueSlug(base: string): Promise<string> {
  const admin = getSupabaseAdmin()
  // Try the bare slug first; on collision, append a 4-char random suffix
  // and retry up to 5 times before giving up.
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`
    const { data } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (!data) return candidate
  }
  // Fallback: timestamp-suffixed, definitely unique
  return `${base}-${Date.now().toString(36)}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const orgName = typeof body.orgName === 'string' ? body.orgName.trim().slice(0, 80) : ''
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 80) : ''

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
    }
    if (!orgName) {
      return NextResponse.json({ error: 'A business / studio name is required.' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // Reject if an auth user with this email already exists. We use the
    // profiles table as the proxy check since listUsers() requires
    // pagination and is heavier.
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (existingProfile) {
      return NextResponse.json(
        { error: 'An account with that email already exists. Try signing in instead.' },
        { status: 409 },
      )
    }

    const slug = await uniqueSlug(slugify(orgName))

    // 1. Create auth user (no password — they set it via invite link).
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { full_name: fullName || null, signup_source: 'self-serve' },
    })
    if (authError || !authData?.user) {
      console.error('[signup] auth user create failed:', authError)
      return NextResponse.json(
        { error: authError?.message || 'Could not create your account. Please try again.' },
        { status: 500 },
      )
    }
    const userId = authData.user.id

    // 2. Create organization (14-day trial, default starter tier).
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({
        name: orgName,
        slug,
        owner_id: userId,
        subscription_tier: SIGNUP_TIER,
        subscription_status: 'trialing',
        trial_ends_at: trialEnd.toISOString(),
        client_limit: SIGNUP_TIER_CLIENT_LIMIT,
      })
      .select('id, name, slug')
      .single()

    if (orgError || !org) {
      console.error('[signup] org insert failed:', orgError)
      // Roll back the auth user so we don't leave an orphan.
      await admin.auth.admin.deleteUser(userId).catch(() => {})
      return NextResponse.json(
        { error: 'Could not create your studio. Please try again.' },
        { status: 500 },
      )
    }

    // 3. Create profile (role=company_admin so the trainer owns their org
    //    and can invite team members later if they upgrade).
    const { error: profileError } = await admin
      .from('profiles')
      .upsert({
        id: userId,
        email,
        full_name: fullName || null,
        role: 'company_admin',
        organization_id: org.id,
        is_active: true,
        must_change_password: true,
        password_changed: false,
        status: 'pending',
      })
    if (profileError) {
      console.error('[signup] profile upsert failed:', profileError)
      // Don't roll back — auth + org exist, profile can be repaired manually
    }

    // 4. Issue invite_token. The token is DB-generated.
    const { data: tokenRow, error: tokenError } = await admin
      .from('invite_tokens')
      .insert({
        user_id: userId,
        email,
        created_by: null, // self-signup, no inviter
      })
      .select('token')
      .single()

    if (tokenError || !tokenRow) {
      console.error('[signup] invite token create failed:', tokenError)
      return NextResponse.json(
        {
          error: 'Your account was created but the email link could not be generated. Contact support.',
          userId,
        },
        { status: 500 },
      )
    }

    // 5. Send the "set your password" email. Reuses the existing invite
    //    template — the orgName context makes it read naturally for a
    //    self-signup trainer ("CMPD Fitness account is ready").
    let emailSent = false
    let emailError: string | null = null
    try {
      await sendInviteEmail({
        email,
        fullName: fullName || null,
        token: tokenRow.token,
        orgName,
      })
      emailSent = true
    } catch (e) {
      console.error('[signup] invite email send failed:', e)
      emailError = e instanceof Error ? e.message : 'Email failed to send'
    }

    // 6. Create Stripe customer (best-effort — failure here doesn't block
    //    signup, since the org can be linked to a Stripe customer later
    //    when the trainer adds their card on day 14).
    try {
      const stripe = getStripe()
      const customer = await stripe.customers.create({
        email,
        name: orgName,
        metadata: {
          organization_id: org.id,
          signup: 'true',
        },
      })
      await admin
        .from('organizations')
        .update({ stripe_customer_id: customer.id })
        .eq('id', org.id)
    } catch (e) {
      console.error('[signup] Stripe customer create failed (non-blocking):', e)
    }

    // Fallback link the frontend can show if the email send failed.
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.cmpdcollective.com'}/accept-invite?token=${tokenRow.token}`

    return NextResponse.json({
      success: true,
      email,
      organization: { id: org.id, name: org.name, slug: org.slug },
      emailSent,
      emailError,
      // Only surface the fallback link if the email send failed — keeps
      // happy-path responses clean.
      inviteLink: emailSent ? null : inviteLink,
    })
  } catch (error) {
    console.error('[signup] unexpected error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }
}
