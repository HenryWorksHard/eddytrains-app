import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPasswordResetEmail } from '@/app/lib/email'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.cmpdcollective.com'
}

/**
 * Public endpoint that takes an email and (if a user exists) sends them a
 * branded Resend reset email containing a Supabase recovery link. Always
 * returns the same generic success shape so an attacker can't enumerate
 * registered addresses.
 */
export async function POST(req: Request) {
  let email: string
  try {
    const body = await req.json()
    email = String(body?.email || '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ ok: true })
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: true })
  }

  try {
    const admin = getAdminClient()
    const redirectTo = `${getAppUrl()}/update-password`

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    })

    // generateLink errors when the email isn't a registered user. Swallow
    // silently — same generic response either way so we don't leak which
    // addresses exist.
    if (linkErr || !linkData?.properties?.action_link) {
      return NextResponse.json({ ok: true })
    }

    const userId = linkData.user?.id
    let fullName: string | null = null
    if (userId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle()
      fullName = profile?.full_name ?? null
    }

    await sendPasswordResetEmail({
      email,
      fullName,
      resetLink: linkData.properties.action_link,
    })
  } catch (e) {
    console.error('[send-password-reset] failed:', e)
  }

  return NextResponse.json({ ok: true })
}
