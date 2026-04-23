import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext, unauthorized } from '@/app/lib/auth-guard'
import { sendPasswordChangedEmail } from '@/app/lib/email'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Fire-and-forget endpoint called by the client after a successful
 * `auth.updateUser({ password })`. We resolve the email + name server-side
 * (admin client) so the browser never has to pass them — and so an
 * attacker can't trigger this for an arbitrary address.
 */
export async function POST() {
  const ctx = await getAuthContext()
  if (!ctx) return unauthorized()

  const admin = getAdminClient()
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, email')
      .eq('id', ctx.userId)
      .maybeSingle()

    const email = ctx.email || profile?.email || null
    if (!email) {
      return NextResponse.json({ ok: false, reason: 'no email on file' }, { status: 200 })
    }

    await sendPasswordChangedEmail({
      email,
      fullName: profile?.full_name || null,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[notify-password-changed] send failed:', e)
    // Always 200 — caller is fire-and-forget and we never want to block
    // the password-change flow on email delivery.
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
