import { NextResponse } from 'next/server'
import { getAuthContext, isTrainerRole, unauthorized, forbidden } from '@/app/lib/auth-guard'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isIntakeStatus } from '@/app/lib/intake'

// The enquiry list for the trainer side.
//
// Intake submissions are not scoped to an organisation: they come from the
// public landing page, before the person is anyone's client. Any trainer-role
// account can see them, which today means Eddy and the super admin.

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const ctx = await getAuthContext()
  if (!ctx) return unauthorized()
  if (!isTrainerRole(ctx.role)) return forbidden()

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 200)

  const admin = getSupabaseAdmin()
  let q = admin
    .from('intake_submissions')
    .select('id, created_at, status, first_name, last_name, email, phone, areas, red_flags')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status && status !== 'all' && isIntakeStatus(status)) q = q.eq('status', status)

  const { data, error } = await q
  if (error) {
    // The table not existing yet is the expected case before the migration is
    // run, and it should read as "nothing here" rather than a broken page.
    if (error.code === '42P01') {
      return NextResponse.json({ submissions: [], counts: {}, notSetUp: true })
    }
    console.error('[enquiries] list failed:', error.message)
    return NextResponse.json({ error: 'Could not load enquiries' }, { status: 500 })
  }

  // One extra cheap query so the tab badges do not need a second round trip
  // each, and so "New" is visible without opening the filter.
  const { data: all } = await admin.from('intake_submissions').select('status')
  const counts: Record<string, number> = {}
  for (const row of all ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1

  return NextResponse.json({ submissions: data ?? [], counts })
}
