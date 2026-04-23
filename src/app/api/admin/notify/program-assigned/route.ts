import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getAuthContext,
  unauthorized,
  forbidden,
  isTrainerRole,
} from '@/app/lib/auth-guard'
import { sendProgramAssignedEmail } from '@/app/lib/email'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Fire-and-forget endpoint called by trainer-side UI after a successful
 * `client_programs.insert`. We resolve client email/name, program name,
 * and trainer name server-side via the admin client, then send the
 * notification. Always returns 200 — the caller never blocks on email.
 */
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return unauthorized()
  if (!isTrainerRole(ctx.role)) return forbidden()

  let body: { clientId?: unknown; programId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const clientId = typeof body.clientId === 'string' ? body.clientId : null
  const programId = typeof body.programId === 'string' ? body.programId : null
  if (!clientId || !programId) {
    return NextResponse.json({ ok: false, error: 'clientId and programId required' }, { status: 400 })
  }

  const admin = getAdminClient()
  try {
    // Resolve client (must be in same org as the trainer, unless super_admin)
    const { data: client } = await admin
      .from('profiles')
      .select('id, email, full_name, organization_id')
      .eq('id', clientId)
      .maybeSingle()

    if (!client?.email) {
      return NextResponse.json({ ok: false, reason: 'client missing or no email' }, { status: 200 })
    }

    if (
      ctx.role !== 'super_admin' &&
      (!ctx.organizationId || ctx.organizationId !== client.organization_id)
    ) {
      return forbidden()
    }

    // Resolve program name + trainer display name in parallel.
    const [{ data: program }, { data: trainer }] = await Promise.all([
      admin.from('programs').select('name').eq('id', programId).maybeSingle(),
      admin.from('profiles').select('full_name').eq('id', ctx.userId).maybeSingle(),
    ])

    const programName = program?.name || 'New program'

    await sendProgramAssignedEmail({
      email: client.email,
      fullName: client.full_name || null,
      programName,
      trainerName: trainer?.full_name || null,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[notify-program-assigned] send failed:', e)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
