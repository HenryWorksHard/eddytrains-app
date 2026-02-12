import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all exercises from user's assigned programs
    const today = new Date().toISOString().split('T')[0]
    
    const { data: clientPrograms } = await supabase
      .from('client_programs')
      .select(`
        program_id,
        programs (
          program_workouts (
            workout_exercises (
              exercise_name
            )
          )
        )
      `)
      .eq('client_id', user.id)
      .eq('is_active', true)

    const exerciseNames = new Set<string>()
    
    // Extract exercise names from assigned programs
    clientPrograms?.forEach(cp => {
      const programs = cp.programs as any
      const programData = Array.isArray(programs) ? programs[0] : programs
      programData?.program_workouts?.forEach((workout: any) => {
        workout?.workout_exercises?.forEach((ex: any) => {
          if (ex?.exercise_name) {
            exerciseNames.add(ex.exercise_name)
          }
        })
      })
    })

    // Also get exercises from logged workouts (in case program changed)
    const { data: workoutLogs } = await supabase
      .from('workout_logs')
      .select('id')
      .eq('client_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(50)

    if (workoutLogs && workoutLogs.length > 0) {
      const workoutLogIds = workoutLogs.map(log => log.id)
      
      const { data: setLogs } = await supabase
        .from('set_logs')
        .select('exercise_id')
        .in('workout_log_id', workoutLogIds)

      if (setLogs && setLogs.length > 0) {
        const exerciseIds = [...new Set(setLogs.map(s => s.exercise_id))]
        
        const { data: loggedExercises } = await supabase
          .from('workout_exercises')
          .select('exercise_name')
          .in('id', exerciseIds)
        
        loggedExercises?.forEach(e => {
          if (e.exercise_name) exerciseNames.add(e.exercise_name)
        })
      }
    }

    // Convert to array and sort
    const exercises = Array.from(exerciseNames)
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ name }))

    return NextResponse.json({ exercises })
  } catch (error) {
    console.error('Exercises fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch exercises' }, { status: 500 })
  }
}
