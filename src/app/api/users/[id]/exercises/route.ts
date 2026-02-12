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
    
    const exerciseMap = new Map<string, string>()

    // 1. Get exercises from active programs
    const { data: clientPrograms } = await adminClient
      .from('client_programs')
      .select('program_id')
      .eq('client_id', clientId)
      .eq('is_active', true)

    if (clientPrograms && clientPrograms.length > 0) {
      const programIds = clientPrograms.map(cp => cp.program_id)

      const { data: programWorkouts } = await adminClient
        .from('program_workouts')
        .select('id')
        .in('program_id', programIds)

      if (programWorkouts && programWorkouts.length > 0) {
        const workoutIds = programWorkouts.map(pw => pw.id)

        const { data: workoutExercises } = await adminClient
          .from('workout_exercises')
          .select('id, exercise_name')
          .in('workout_id', workoutIds)

        if (workoutExercises) {
          workoutExercises.forEach(we => {
            if (!exerciseMap.has(we.exercise_name)) {
              exerciseMap.set(we.exercise_name, we.id)
            }
          })
        }
      }
    }

    // 2. Get exercises from workout history (completed workouts)
    const { data: workoutLogs } = await adminClient
      .from('workout_logs')
      .select('id')
      .eq('client_id', clientId)

    if (workoutLogs && workoutLogs.length > 0) {
      const logIds = workoutLogs.map(wl => wl.id)

      // Get set_logs for these workout_logs (not exercise_logs - that table doesn't exist)
      const { data: setLogs } = await adminClient
        .from('set_logs')
        .select('exercise_id')
        .in('workout_log_id', logIds)

      if (setLogs && setLogs.length > 0) {
        const exerciseIds = [...new Set(setLogs.map(sl => sl.exercise_id))]

        const { data: exercises } = await adminClient
          .from('workout_exercises')
          .select('id, exercise_name')
          .in('id', exerciseIds)

        if (exercises) {
          exercises.forEach(ex => {
            if (!exerciseMap.has(ex.exercise_name)) {
              exerciseMap.set(ex.exercise_name, ex.id)
            }
          })
        }
      }
    }

    const exercises = Array.from(exerciseMap.entries()).map(([name, id]) => ({
      id,
      name
    })).sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ exercises })
  } catch (error) {
    console.error('Exercises fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch exercises' }, { status: 500 })
  }
}
