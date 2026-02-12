import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params
    const adminClient = getAdminClient()
    
    const { data: streakData, error } = await adminClient
      .from('client_streaks')
      .select('current_streak, longest_streak, last_workout_date')
      .eq('client_id', clientId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching streak:', error)
      return NextResponse.json({ error: 'Failed to fetch streak' }, { status: 500 })
    }

    return NextResponse.json({ streak: streakData || null })
  } catch (error) {
    console.error('Streak fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch streak' }, { status: 500 })
  }
}
