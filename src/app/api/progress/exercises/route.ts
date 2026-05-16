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

    // Pull set_logs along with their swapped_exercise_name. The
    // dropdown needs to surface what the user actually did, which is
    // COALESCE(swapped_exercise_name, original program slot name).
    // Otherwise a swapped exercise (e.g. "Dumbbell Press" swapped in
    // for Bench Press) never appears in the progress dropdown.
    const { data: setLogs } = await supabase
      .from('set_logs')
      .select('exercise_id, swapped_exercise_name')
      .in('workout_log_id', workoutLogIds)
      .not('weight_kg', 'is', null)
      .not('reps_completed', 'is', null)

    if (!setLogs || setLogs.length === 0) {
      return NextResponse.json({ exercises: [] })
    }

    const exerciseNames = new Set<string>()
    const slotIdsNeedingNames = new Set<string>()

    for (const s of setLogs) {
      if (s.swapped_exercise_name) {
        const name = String(s.swapped_exercise_name).trim()
        if (name) exerciseNames.add(name)
      } else if (s.exercise_id) {
        slotIdsNeedingNames.add(s.exercise_id)
      }
    }

    if (slotIdsNeedingNames.size > 0) {
      const { data: loggedExercises } = await supabase
        .from('workout_exercises')
        .select('exercise_name')
        .in('id', Array.from(slotIdsNeedingNames))

      loggedExercises?.forEach((e) => {
        if (e.exercise_name) exerciseNames.add(e.exercise_name)
      })
    }

    const exercises = Array.from(exerciseNames)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name }))

    return NextResponse.json({ exercises })
  } catch (error) {
    console.error('Exercises fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch exercises' }, { status: 500 })
  }
}
