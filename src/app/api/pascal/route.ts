import { createClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { recomputeAndPersistPascal } from '@/app/lib/pascal-server'

/**
 * GET /api/pascal?tz=IANA/Zone
 *
 * Returns the user's Pascal score, bringing it up to date from the
 * stored watermark to the client's local "today". Lazy evaluation —
 * no cron needed.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tz = searchParams.get('tz') || 'UTC'

  try {
    const result = await recomputeAndPersistPascal(supabase, user.id, tz)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[pascal] error:', error)
    return NextResponse.json({ error: 'Failed to compute score' }, { status: 500 })
  }
}
