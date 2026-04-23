import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized, forbidden, authorizeUserAccess, isTrainerRole } from '@/app/lib/auth-guard'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// PATCH /api/users/[id]/pause
// Trainer toggles a single client's app access. Used to lock out clients who
// haven't paid their (off-platform) PT invoices, without affecting the
// trainer's Stripe subscription or other clients in the same org.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()

    // Only trainer-side roles can pause clients.
    if (!isTrainerRole(ctx.role)) return forbidden()

    const { id: targetId } = await params
    const { allowed, profile } = await authorizeUserAccess(ctx, targetId)
    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (!allowed) return forbidden()

    const body = await request.json().catch(() => ({}))
    if (typeof body?.paused !== 'boolean') {
      return NextResponse.json({ error: 'Body must include `paused: boolean`' }, { status: 400 })
    }

    const admin = getAdminClient()

    // Confirm target is a client — pausing trainer/admin/super_admin would be
    // a footgun (and is intentionally a no-op per the column comment).
    const { data: targetRoleRow } = await admin
      .from('profiles')
      .select('role')
      .eq('id', profile.id)
      .single()

    if (!targetRoleRow || targetRoleRow.role !== 'client') {
      return NextResponse.json({ error: 'Only client users can be paused' }, { status: 400 })
    }

    const paused: boolean = body.paused
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        access_paused: paused,
        access_paused_at: paused ? new Date().toISOString() : null,
      })
      .eq('id', profile.id)

    if (updateError) {
      console.error('[pause] update error:', updateError)
      return NextResponse.json({ error: 'Failed to update access' }, { status: 500 })
    }

    return NextResponse.json({ success: true, access_paused: paused })
  } catch (error) {
    console.error('[pause] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
