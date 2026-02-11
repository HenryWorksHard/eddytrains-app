import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all workout logs for this user
    const { data: workoutLogs } = await supabase
      .from('workout_logs')
      .select('id')
      .eq('client_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(100)

    if (!workoutLogs || workoutLogs.length === 0) {
      return NextResponse.json({ exercises: [] })
    }

    const workoutLogIds = workoutLogs.map(log => log.id)

    // Get unique exercise IDs from set_logs
    const { data: setLogs } = await supabase
      .from('set_logs')
      .select('exercise_id')
      .in('workout_log_id', workoutLogIds)
      .not('weight_kg', 'is', null)

    if (!setLogs || setLogs.length === 0) {
      return NextResponse.json({ exercises: [] })
    }

    const exerciseIds = [...new Set(setLogs.map(s => s.exercise_id))]

    // Get exercise names
    const { data: exercises } = await supabase
      .from('workout_exercises')
      .select('id, exercise_name')
      .in('id', exerciseIds)

    if (!exercises) {
      return NextResponse.json({ exercises: [] })
    }

    // Dedupe by exercise name and sort
    const uniqueExercises = [...new Map(
      exercises.map(e => [e.exercise_name, { id: e.id, name: e.exercise_name }])
    ).values()].sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ exercises: uniqueExercises })
  } catch (error) {
    console.error('Exercises fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch exercises' }, { status: 500 })
  }
}
