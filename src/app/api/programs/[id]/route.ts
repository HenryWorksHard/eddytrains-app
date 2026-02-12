import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/app/lib/supabase/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Verify user is authenticated
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin/trainer/super_admin
    const { data: profile } = await getAdminClient()
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile?.role || !['admin', 'trainer', 'super_admin', 'company_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch program with all nested data
    const { data: program, error: programError } = await getAdminClient()
      .from('programs')
      .select('*')
      .eq('id', id)
      .single()

    if (programError) {
      console.error('Error fetching program:', programError)
      throw programError
    }

    // Fetch parent workouts (where parent_workout_id is null)
    const { data: workouts, error: workoutsError } = await getAdminClient()
      .from('program_workouts')
      .select(`
        *,
        workout_exercises (
          *,
          exercise_sets (*),
          exercises:exercise_uuid (category, muscle_group)
        )
      `)
      .eq('program_id', id)
      .is('parent_workout_id', null)
      .order('order_index')

    if (workoutsError) {
      console.error('Error fetching workouts:', workoutsError)
      throw workoutsError
    }

    // Fetch finishers (child workouts) and attach to parents
    const { data: finishers, error: finishersError } = await getAdminClient()
      .from('program_workouts')
      .select(`
        *,
        workout_exercises (
          *,
          exercise_sets (*),
          exercises:exercise_uuid (category, muscle_group)
        )
      `)
      .eq('program_id', id)
      .not('parent_workout_id', 'is', null)

    if (finishersError) {
      console.error('Error fetching finishers:', finishersError)
      // Don't throw - finishers are optional
    }

    // Helper to transform workout exercises with category from joined exercises table
    const transformExercises = (exercises: any[]) => {
      return exercises?.map(ex => ({
        ...ex,
        // Use category from exercises table if available, fallback to muscle_group
        category: ex.exercises?.category || ex.exercises?.muscle_group || ex.category || 'strength',
        exercises: undefined // Remove the nested exercises object
      })) || []
    }

    // Transform workouts to include exercise categories
    const transformedWorkouts = (workouts || []).map(workout => ({
      ...workout,
      workout_exercises: transformExercises(workout.workout_exercises)
    }))

    // Transform finishers similarly
    const transformedFinishers = (finishers || []).map(finisher => ({
      ...finisher,
      workout_exercises: transformExercises(finisher.workout_exercises)
    }))

    // Attach finishers to their parent workouts
    const workoutsWithFinishers = transformedWorkouts.map(workout => {
      const finisher = transformedFinishers?.find(f => f.parent_workout_id === workout.id)
      return {
        ...workout,
        finisher: finisher || null
      }
    })

    return NextResponse.json({ 
      program,
      workouts: workoutsWithFinishers
    })

  } catch (error) {
    console.error('Error getting program:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get program' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Verify user is authenticated and is admin
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await getAdminClient()
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile?.role || !['admin', 'trainer', 'super_admin', 'company_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete program (should cascade)
    const { error } = await getAdminClient()
      .from('programs')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting program:', error)
      throw error
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting program:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete program' },
      { status: 500 }
    )
  }
}
