import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only surface exercises the user has actual logged data for
    // (non-null weight + reps), so the dropdown never shows dead options.
    const { data: workoutLogs } = await supabase
      .from('workout_logs')
      .select('id')
      .eq('client_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(500)

    if (!workoutLogs || workoutLogs.length === 0) {
      return NextResponse.json({ exercises: [] })
    }

    const workoutLogIds = workoutLogs.map((l) => l.id)

    const { data: setLogs } = await supabase
      .from('set_logs')
      .select('exercise_id')
      .in('workout_log_id', workoutLogIds)
      .not('weight_kg', 'is', null)
      .not('reps_completed', 'is', null)

    if (!setLogs || setLogs.length === 0) {
      return NextResponse.json({ exercises: [] })
    }

    const exerciseIds = [...new Set(setLogs.map((s) => s.exercise_id).filter(Boolean))]
    if (exerciseIds.length === 0) {
      return NextResponse.json({ exercises: [] })
    }

    const { data: loggedExercises } = await supabase
      .from('workout_exercises')
      .select('exercise_name')
      .in('id', exerciseIds)

    const exerciseNames = new Set<string>()
    loggedExercises?.forEach((e) => {
      if (e.exercise_name) exerciseNames.add(e.exercise_name)
    })

    const exercises = Array.from(exerciseNames)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name }))

    return NextResponse.json({ exercises })
  } catch (error) {
    console.error('Exercises fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch exercises' }, { status: 500 })
  }
}
