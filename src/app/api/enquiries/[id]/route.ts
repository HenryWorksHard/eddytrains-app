import { NextResponse } from 'next/server'
import { getAuthContext, isTrainerRole, unauthorized, forbidden } from '@/app/lib/auth-guard'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isIntakeStatus } from '@/app/lib/intake'

// One enquiry: read it, move its status, keep notes against it.

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return unauthorized()
  if (!isTrainerRole(ctx.role)) return forbidden()

  const { id } = await params
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('intake_submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ error: 'Not set up yet' }, { status: 503 })
    console.error('[enquiries] get failed:', error.message)
    return NextResponse.json({ error: 'Could not load the enquiry' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ submission: data })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return unauthorized()
  if (!isTrainerRole(ctx.role)) return forbidden()

  const { id } = await params
  let body: { status?: string; notes?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (body.status !== undefined) {
    if (!isIntakeStatus(body.status)) {
      return NextResponse.json({ error: 'Unknown status' }, { status: 422 })
    }
    patch.status = body.status
  }
  if (body.notes !== undefined) patch.notes = String(body.notes).slice(0, 8000)
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 422 })
  }

  // Who touched it last, so two people on the same inbox can tell.
  patch.handled_by = ctx.userId
  patch.handled_at = new Date().toISOString()

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('intake_submissions')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('[enquiries] update failed:', error.message)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ submission: data })
}
