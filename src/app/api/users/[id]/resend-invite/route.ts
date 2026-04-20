import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendInviteEmail } from '@/app/lib/email'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/users/[id]/resend-invite
// Generates a fresh invite token for a pending client and emails it.
// Invalidates any existing active tokens for that user so old links stop working.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params

    // Auth: caller must be admin/trainer/company_admin/super_admin
    const supabase = await createServerClient()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = getAdminClient()

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('id, role, organization_id, full_name')
      .eq('id', caller.id)
      .single()

    const allowedRoles = ['trainer', 'admin', 'company_admin', 'super_admin']
    if (!callerProfile || !allowedRoles.includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Load the target client
    const { data: target } = await admin
      .from('profiles')
      .select('id, email, full_name, role, organization_id, password_changed')
      .eq('id', userId)
      .single()

    if (!target) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    if (target.role !== 'client') {
      return NextResponse.json({ error: 'Can only resend invites to clients' }, { status: 400 })
    }
    if (target.password_changed) {
      return NextResponse.json({
        error: 'This client has already accepted their invite. No need to resend.',
      }, { status: 400 })
    }
    // Same-org check (super_admin can cross orgs)
    if (
      callerProfile.role !== 'super_admin' &&
      target.organization_id !== callerProfile.organization_id
    ) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Invalidate any outstanding tokens for this user
    await admin
      .from('invite_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('used_at', null)

    // Issue a fresh token
    const { data: tokenRow, error: tokenError } = await admin
      .from('invite_tokens')
      .insert({
        user_id: userId,
        email: target.email,
        created_by: caller.id,
      })
      .select('token')
      .single()

    if (tokenError || !tokenRow) {
      console.error('[resend-invite] token insert error:', tokenError)
      return NextResponse.json({ error: 'Failed to generate invite token' }, { status: 500 })
    }

    // Org name for the email
    let orgName: string | null = null
    if (target.organization_id) {
      const { data: org } = await admin
        .from('organizations')
        .select('name')
        .eq('id', target.organization_id)
        .single()
      orgName = org?.name ?? null
    }

    let inviteSent = false
    let inviteError: string | null = null
    try {
      await sendInviteEmail({
        email: target.email,
        fullName: target.full_name,
        token: tokenRow.token,
        trainerName: callerProfile.full_name,
        orgName,
      })
      inviteSent = true
    } catch (e) {
      console.error('[resend-invite] email error:', e)
      inviteError = e instanceof Error ? e.message : 'Email failed'
    }

    return NextResponse.json({
      success: true,
      inviteSent,
      inviteError,
      inviteLink: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.cmpdcollective.com'}/accept-invite?token=${tokenRow.token}`,
    })
  } catch (error) {
    console.error('[resend-invite] error:', error)
    return NextResponse.json({ error: 'Failed to resend invite' }, { status: 500 })
  }
}
