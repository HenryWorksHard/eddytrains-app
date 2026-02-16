import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workoutLogId, sets } = body
    
    if (!workoutLogId || !sets) {
      return NextResponse.json({ error: 'Missing workoutLogId or sets' }, { status: 400 })
    }

    const adminClient = getAdminClient()
    
    // Update each set
    for (const set of sets) {
      const { error } = await adminClient
        .from('set_logs')
        .update({
          weight_kg: set.weight_kg,
          reps_completed: set.reps_completed
        })
        .eq('workout_log_id', workoutLogId)
        .eq('exercise_id', set.exercise_id)
        .eq('set_number', set.set_number)

      if (error) {
        console.error('Error updating set:', error)
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Coaching update error:', error)
    return NextResponse.json({ error: 'Failed to update sets' }, { status: 500 })
  }
}
