import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  // Verify trainer is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const date = searchParams.get('date')

  if (!clientId || !date) {
    return NextResponse.json({ error: 'Missing clientId or date' }, { status: 400 })
  }

  try {
    // Try to find workout log by scheduled_date first (use maybeSingle to avoid errors)
    let workoutLog = null
    
    const { data: byScheduled, error: schedError } = await supabaseAdmin
      .from('workout_logs')
      .select(`
        id,
        workout_id,
        completed_at,
        notes,
        rating,
        trainer_id
      `)
      .eq('client_id', clientId)
      .eq('scheduled_date', date)
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (byScheduled && byScheduled.length > 0) {
      workoutLog = byScheduled[0]
    } else {
      // Fallback: check by completed_at date
      const startOfDay = new Date(date + 'T00:00:00.000Z')
      const endOfDay = new Date(date + 'T23:59:59.999Z')
      
      const { data: byCompleted } = await supabaseAdmin
        .from('workout_logs')
        .select(`
          id,
          workout_id,
          completed_at,
          notes,
          rating,
          trainer_id
        `)
        .eq('client_id', clientId)
        .gte('completed_at', startOfDay.toISOString())
        .lte('completed_at', endOfDay.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (byCompleted && byCompleted.length > 0) {
        workoutLog = byCompleted[0]
      }
    }

    if (!workoutLog) {
      return NextResponse.json({ workoutLog: null })
    }

    // Get workout name
    const { data: workout } = await supabaseAdmin
      .from('program_workouts')
      .select('name')
      .eq('id', workoutLog.workout_id)
      .single()

    // Get trainer name if exists
    let trainerName = null
    if (workoutLog.trainer_id) {
      const { data: trainer } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', workoutLog.trainer_id)
        .single()
      trainerName = trainer?.full_name
    }

    // Get ALL exercises for this workout (not just logged ones)
    const { data: allExercises } = await supabaseAdmin
      .from('workout_exercises')
      .select(`
        id,
        exercise_name,
        order_index,
        exercise_sets (
          set_number,
          reps
        )
      `)
      .eq('workout_id', workoutLog.workout_id)
      .order('order_index')

    // Get logged set data
    const { data: setLogs } = await supabaseAdmin
      .from('set_logs')
      .select(`
        set_number,
        weight_kg,
        reps_completed,
        exercise_id
      `)
      .eq('workout_log_id', workoutLog.id)
      .order('set_number')

    // Create a map of logged data by exercise_id and set_number
    const loggedData = new Map()
    setLogs?.forEach(log => {
      const key = `${log.exercise_id}-${log.set_number}`
      loggedData.set(key, { weight_kg: log.weight_kg, reps_completed: log.reps_completed })
    })

    // Build sets array with ALL exercises, showing empty for unlogged
    const sets: any[] = []
    allExercises?.forEach(exercise => {
      const exerciseSets = exercise.exercise_sets || []
      exerciseSets.sort((a: any, b: any) => a.set_number - b.set_number)
      
      exerciseSets.forEach((set: any) => {
        const key = `${exercise.id}-${set.set_number}`
        const logged = loggedData.get(key)
        
        sets.push({
          exercise_id: exercise.id,
          exercise_name: exercise.exercise_name,
          set_number: set.set_number,
          weight_kg: logged?.weight_kg ?? null,
          reps_completed: logged?.reps_completed ?? null,
          target_reps: set.reps
        })
      })
    })

    return NextResponse.json({
      workoutLog: {
        id: workoutLog.id,
        workout_name: workout?.name || 'Workout',
        completed_at: workoutLog.completed_at,
        notes: workoutLog.notes,
        rating: workoutLog.rating,
        trainer_name: trainerName,
        sets
      }
    })
  } catch (err: any) {
    console.error('Error fetching workout details:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
