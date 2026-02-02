import { createClient } from '../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workoutId, clientProgramId, scheduledDate } = await request.json()

  if (!workoutId || !scheduledDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Insert completion record
  const { data, error } = await supabase
    .from('workout_completions')
    .upsert({
      client_id: user.id,
      workout_id: workoutId,
      client_program_id: clientProgramId || null,
      scheduled_date: scheduledDate,
      completed_at: new Date().toISOString()
    }, {
      onConflict: 'client_id,workout_id,scheduled_date'
    })
    .select()
    .single()

  if (error) {
    console.error('Error completing workout:', error)
    return NextResponse.json({ error: 'Failed to complete workout' }, { status: 500 })
  }

  return NextResponse.json({ success: true, completion: data })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  let query = supabase
    .from('workout_completions')
    .select('*')
    .eq('client_id', user.id)
    .order('scheduled_date', { ascending: false })

  if (startDate) {
    query = query.gte('scheduled_date', startDate)
  }
  if (endDate) {
    query = query.lte('scheduled_date', endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching completions:', error)
    return NextResponse.json({ error: 'Failed to fetch completions' }, { status: 500 })
  }

  return NextResponse.json({ completions: data })
}
