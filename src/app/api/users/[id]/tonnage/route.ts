import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized, forbidden, authorizeUserAccess } from '@/app/lib/auth-guard'
import { computeTonnage, type Period } from '@/app/lib/tonnage'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

/**
 * GET /api/users/[id]/tonnage
 *
 * Trainer-facing tonnage. Mirrors the client's `/api/progress/tonnage`
 * response shape — `{ tonnage, series, period }` — so both views agree on
 * day boundaries. Timezone resolution prefers explicit `tz` query param,
 * then the client's stored profile timezone, then UTC.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()
    const { id: clientId } = await params
    const gate = await authorizeUserAccess(ctx, clientId)
    if (!gate.profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (!gate.allowed) return forbidden()
    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'week') as Period

    const adminClient = getAdminClient()

    // Resolve timezone: explicit query param > profile.timezone > UTC fallback.
    let timezone = searchParams.get('tz') || 'UTC'
    if (!searchParams.get('tz')) {
      const { data: profileData } = await adminClient
        .from('profiles')
        .select('timezone')
        .eq('id', clientId)
        .single()
      if (profileData?.timezone) timezone = profileData.timezone
    }

    const result = await computeTonnage(adminClient, clientId, period, timezone)

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (error) {
    console.error('Tonnage fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch tonnage' }, { status: 500 })
  }
}
