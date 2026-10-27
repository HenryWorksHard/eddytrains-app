import { getVerifiedUser } from '@/app/lib/auth-claims'
import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computeWeeklyAdherence } from '@/app/lib/adherence'

/**
 * GET /api/adherence
 *
 * How much of the programmed week the client has done, computed fresh.
 * Returns { adherence: null } when there is no active program to measure
 * against, and the dashboard renders nothing rather than a zero.
 */
export async function GET() {
  const supabase = await createClient()
  const user = await getVerifiedUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const adherence = await computeWeeklyAdherence(supabase, user.id)
    return NextResponse.json({ adherence })
  } catch (error) {
    console.error('[adherence] error:', error)
    return NextResponse.json({ error: 'Failed to compute adherence' }, { status: 500 })
  }
}
