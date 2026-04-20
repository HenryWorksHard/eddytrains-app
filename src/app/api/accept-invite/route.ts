import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET — validate a token without consuming it. Used by the /accept-invite page on load
// so we can show the user's email and catch expired/invalid tokens early.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const admin = getAdminClient()
  const { data: row, error } = await admin
    .from('invite_tokens')
    .select('token, user_id, email, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ valid: false, reason: 'invalid' }, { status: 404 })
  }
  if (row.used_at) {
    return NextResponse.json({ valid: false, reason: 'used' }, { status: 410 })
  }
  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: 'expired' }, { status: 410 })
  }

  return NextResponse.json({ valid: true, email: row.email })
}

// POST — consume the token and set the user's password.
export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const admin = getAdminClient()

    const { data: row, error: fetchError } = await admin
      .from('invite_tokens')
      .select('token, user_id, email, expires_at, used_at')
      .eq('token', token)
      .maybeSingle()

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 })
    }
    if (row.used_at) {
      return NextResponse.json({ error: 'This invite link has already been used' }, { status: 410 })
    }
    if (new Date(row.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite link has expired. Ask your trainer to send a new one.' }, { status: 410 })
    }

    // Set the password
    const { error: updateError } = await admin.auth.admin.updateUserById(row.user_id, { password })
    if (updateError) {
      console.error('[accept-invite] updateUserById error:', updateError)
      return NextResponse.json({ error: 'Failed to set password' }, { status: 500 })
    }

    // Mark token used (and null out all other active tokens for this user, since password is set)
    await admin
      .from('invite_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', row.user_id)
      .is('used_at', null)

    // Flip profile flags so middleware lets them through
    await admin
      .from('profiles')
      .update({
        password_changed: true,
        must_change_password: false,
        status: 'active',
      })
      .eq('id', row.user_id)

    return NextResponse.json({ success: true, email: row.email })
  } catch (error) {
    console.error('[accept-invite] Error:', error)
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 })
  }
}
