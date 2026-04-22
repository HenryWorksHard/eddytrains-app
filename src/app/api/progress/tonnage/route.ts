import { createClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { computeTonnage, type Period } from '@/app/lib/tonnage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'week') as Period
    const timezone = searchParams.get('tz') || 'UTC'

    const result = await computeTonnage(supabase, user.id, period, timezone)

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (error) {
    console.error('[tonnage] error:', error)
    return NextResponse.json({ error: 'Failed to fetch tonnage' }, { status: 500 })
  }
}
