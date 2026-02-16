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
    const workoutId = searchParams.get('workoutId')
    
    if (!workoutId) {
      return NextResponse.json({ error: 'Missing workoutId' }, { status: 400 })
    }

    const adminClient = getAdminClient()
    
    // Get workout with exercises and sets
    const { data: workout, error } = await adminClient
      .from('program_workouts')
      .select(`
        id,
        name,
        workout_exercises (
          id,
          exercise_name,
          order_index,
          exercise_sets (
            set_number,
            reps,
            intensity_type,
            intensity_value
          )
        )
      `)
      .eq('id', workoutId)
      .single()

    if (error) {
      console.error('Error fetching workout preview:', error)
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
    }

    // Transform to simpler format
    const exercises = (workout.workout_exercises || [])
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((ex: any) => ({
        name: ex.exercise_name,
        sets: (ex.exercise_sets || [])
          .sort((a: any, b: any) => a.set_number - b.set_number)
          .map((s: any) => ({
            set_number: s.set_number,
            reps: s.reps,
            intensity: s.intensity_type === 'rir' 
              ? `${s.intensity_value} RIR` 
              : s.intensity_type === 'rpe'
              ? `RPE ${s.intensity_value}`
              : s.intensity_type === 'percentage'
              ? `${s.intensity_value}%`
              : s.intensity_type === 'failure'
              ? 'To Failure'
              : s.intensity_value
          }))
      }))

    return NextResponse.json({
      workout: {
        id: workout.id,
        name: workout.name,
        exercises
      }
    })

  } catch (error) {
    console.error('Coaching preview error:', error)
    return NextResponse.json({ error: 'Failed to fetch workout preview' }, { status: 500 })
  }
}
