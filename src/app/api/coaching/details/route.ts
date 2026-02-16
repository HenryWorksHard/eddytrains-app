import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const date = searchParams.get('date')
    
    if (!clientId || !date) {
      return NextResponse.json({ error: 'Missing clientId or date' }, { status: 400 })
    }

    const adminClient = getAdminClient()
    
    // Get workout log for this date
    const { data: workoutLog, error: logError } = await adminClient
      .from('workout_logs')
      .select(`
        id,
        workout_id,
        completed_at,
        notes,
        rating,
        trainer_id,
        program_workouts (
          id,
          name
        )
      `)
      .eq('client_id', clientId)
      .eq('completed_at::date', date)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    if (logError && logError.code !== 'PGRST116') {
      console.error('Error fetching workout log:', logError)
    }

    if (!workoutLog) {
      return NextResponse.json({ workoutLog: null })
    }

    // Get trainer name if there's a trainer_id
    let trainerName = null
    if (workoutLog.trainer_id) {
      const { data: trainer } = await adminClient
        .from('profiles')
        .select('full_name')
        .eq('id', workoutLog.trainer_id)
        .single()
      trainerName = trainer?.full_name
    }

    // Get set logs for this workout
    const { data: setLogs } = await adminClient
      .from('set_logs')
      .select(`
        id,
        exercise_id,
        set_number,
        weight_kg,
        reps_completed,
        workout_exercises (
          id,
          exercise_name
        )
      `)
      .eq('workout_log_id', workoutLog.id)
      .order('exercise_id')
      .order('set_number')

    const workout = workoutLog.program_workouts as any

    return NextResponse.json({
      workoutLog: {
        id: workoutLog.id,
        workout_name: workout?.name || 'Workout',
        completed_at: workoutLog.completed_at,
        notes: workoutLog.notes,
        rating: workoutLog.rating,
        trainer_name: trainerName,
        sets: (setLogs || []).map(sl => {
          const exercise = sl.workout_exercises as any
          return {
            exercise_id: sl.exercise_id,
            exercise_name: exercise?.exercise_name || 'Unknown',
            set_number: sl.set_number,
            weight_kg: sl.weight_kg,
            reps_completed: sl.reps_completed
          }
        })
      }
    })

  } catch (error) {
    console.error('Coaching details error:', error)
    return NextResponse.json({ error: 'Failed to fetch workout details' }, { status: 500 })
  }
}
