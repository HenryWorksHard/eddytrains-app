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
    const { 
      clientId, 
      workoutId, 
      clientProgramId,
      trainerId, 
      completedAt, 
      scheduledDate,
      notes, 
      rating,
      sets 
    } = body
    
    if (!clientId || !workoutId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const adminClient = getAdminClient()
    
    // Create workout log
    const { data: workoutLog, error: logError } = await adminClient
      .from('workout_logs')
      .insert({
        client_id: clientId,
        workout_id: workoutId,
        trainer_id: trainerId || null,
        completed_at: completedAt || new Date().toISOString(),
        notes: notes || null,
        rating: rating || null
      })
      .select()
      .single()

    if (logError) {
      console.error('Error creating workout log:', logError)
      throw logError
    }

    // Create set logs
    if (sets && sets.length > 0 && workoutLog) {
      const setLogsToInsert = sets.map((set: any) => ({
        workout_log_id: workoutLog.id,
        exercise_id: set.exercise_id,
        set_number: set.set_number,
        weight_kg: set.weight_kg || null,
        reps_completed: set.reps_completed || null
      }))

      const { error: setsError } = await adminClient
        .from('set_logs')
        .insert(setLogsToInsert)

      if (setsError) {
        console.error('Error creating set logs:', setsError)
      }
    }

    // Create workout completion record
    const { error: completionError } = await adminClient
      .from('workout_completions')
      .insert({
        client_id: clientId,
        workout_id: workoutId,
        client_program_id: clientProgramId || null,
        scheduled_date: scheduledDate || completedAt?.split('T')[0] || new Date().toISOString().split('T')[0],
        completed_at: completedAt || new Date().toISOString()
      })

    if (completionError) {
      console.error('Error creating workout completion:', completionError)
    }

    return NextResponse.json({ 
      success: true, 
      workoutLogId: workoutLog.id 
    })

  } catch (error) {
    console.error('Coaching complete error:', error)
    return NextResponse.json({ error: 'Failed to complete workout' }, { status: 500 })
  }
}
