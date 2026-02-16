import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/app/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Verify user is authenticated and is admin
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile?.role || !['admin', 'trainer', 'super_admin', 'company_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, description, category, difficulty, durationWeeks, isActive, workouts } = body

    // 1. Update the program metadata
    const { error: programError } = await supabaseAdmin
      .from('programs')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        category,
        difficulty,
        duration_weeks: durationWeeks,
        is_active: isActive,
      })
      .eq('id', id)

    if (programError) {
      console.error('Program update error:', programError)
      throw programError
    }

    // 2. Get existing workouts from DB
    const { data: existingWorkouts } = await supabaseAdmin
      .from('program_workouts')
      .select('id')
      .eq('program_id', id)
      .is('parent_workout_id', null) // Only parent workouts, not finishers
    
    const existingWorkoutIds = new Set(existingWorkouts?.map(w => w.id) || [])
    const incomingWorkoutIds = new Set(workouts?.map((w: any) => w.id) || [])

    // 3. Determine which workouts to add, update, or delete
    const workoutsToAdd: any[] = []
    const workoutsToUpdate: any[] = []
    
    for (const workout of (workouts || [])) {
      // Check if this is a UUID (existing) or a short client-generated ID (new)
      const isExistingWorkout = existingWorkoutIds.has(workout.id)
      
      if (isExistingWorkout) {
        workoutsToUpdate.push(workout)
      } else {
        workoutsToAdd.push(workout)
      }
    }

    // Find workouts to delete (exist in DB but not in incoming)
    const workoutIdsToDelete: string[] = []
    for (const existingId of existingWorkoutIds) {
      if (!incomingWorkoutIds.has(existingId)) {
        workoutIdsToDelete.push(existingId)
      }
    }

    // 4. Delete removed workouts (only if they have no logs)
    for (const workoutId of workoutIdsToDelete) {
      // Check if workout has logs
      const { data: logs } = await supabaseAdmin
        .from('workout_logs')
        .select('id')
        .eq('workout_id', workoutId)
        .limit(1)
      
      if (logs && logs.length > 0) {
        // Has logs - don't delete, just mark as inactive or skip
        console.log(`Skipping deletion of workout ${workoutId} - has client logs`)
        continue
      }

      // Safe to delete - no logs
      // Delete finishers first
      await supabaseAdmin
        .from('program_workouts')
        .delete()
        .eq('parent_workout_id', workoutId)

      // Delete the workout (cascades to exercises and sets)
      await supabaseAdmin
        .from('program_workouts')
        .delete()
        .eq('id', workoutId)
    }

    // 5. Update existing workouts
    for (const workout of workoutsToUpdate) {
      // Update workout metadata
      await supabaseAdmin
        .from('program_workouts')
        .update({
          name: workout.name,
          day_of_week: workout.dayOfWeek,
          order_index: workout.order,
          notes: workout.notes || null,
          is_emom: workout.isEmom || false,
          emom_interval: workout.emomInterval || null,
          warmup_exercises: workout.warmupExercises || [],
          recovery_notes: workout.recoveryNotes || null,
          week_number: workout.weekNumber || 1,
        })
        .eq('id', workout.id)

      // For exercises, we'll do a simpler approach: delete and recreate
      // (exercises don't have client logs tied to them directly)
      
      // Get existing exercises for this workout
      const { data: existingExercises } = await supabaseAdmin
        .from('workout_exercises')
        .select('id')
        .eq('workout_id', workout.id)
      
      // Delete existing exercises (cascades to sets)
      if (existingExercises && existingExercises.length > 0) {
        await supabaseAdmin
          .from('workout_exercises')
          .delete()
          .eq('workout_id', workout.id)
      }

      // Recreate exercises
      await createExercises(supabaseAdmin, workout.id, workout.exercises)

      // Handle finisher update
      if (workout.finisher) {
        // Check if finisher exists
        const { data: existingFinisher } = await supabaseAdmin
          .from('program_workouts')
          .select('id')
          .eq('parent_workout_id', workout.id)
          .single()

        if (existingFinisher) {
          // Update existing finisher
          await supabaseAdmin
            .from('program_workouts')
            .update({
              name: workout.finisher.name,
              category: workout.finisher.category,
              notes: workout.finisher.notes || null,
              is_emom: workout.finisher.isEmom || false,
              emom_interval: workout.finisher.emomInterval || null,
              is_superset: workout.finisher.isSuperset || false,
            })
            .eq('id', existingFinisher.id)

          // Delete and recreate finisher exercises
          await supabaseAdmin
            .from('workout_exercises')
            .delete()
            .eq('workout_id', existingFinisher.id)

          await createExercises(supabaseAdmin, existingFinisher.id, workout.finisher.exercises)
        } else {
          // Create new finisher
          await createFinisher(supabaseAdmin, id, workout.id, workout.finisher)
        }
      } else {
        // No finisher in incoming - delete if exists
        await supabaseAdmin
          .from('program_workouts')
          .delete()
          .eq('parent_workout_id', workout.id)
      }
    }

    // 6. Add new workouts
    for (const workout of workoutsToAdd) {
      const { data: workoutData, error: workoutError } = await supabaseAdmin
        .from('program_workouts')
        .insert({
          program_id: id,
          name: workout.name,
          day_of_week: workout.dayOfWeek,
          order_index: workout.order,
          notes: workout.notes || null,
          is_emom: workout.isEmom || false,
          emom_interval: workout.emomInterval || null,
          warmup_exercises: workout.warmupExercises || [],
          recovery_notes: workout.recoveryNotes || null,
          week_number: workout.weekNumber || 1,
        })
        .select()
        .single()

      if (workoutError) {
        console.error('Workout insert error:', workoutError)
        throw workoutError
      }

      // Create exercises for new workout
      await createExercises(supabaseAdmin, workoutData.id, workout.exercises)

      // Create finisher if exists
      if (workout.finisher) {
        await createFinisher(supabaseAdmin, id, workoutData.id, workout.finisher)
      }
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error updating program:', error)
    const errorMessage = error?.message || 'Failed to update program'
    const errorDetails = error?.details || error?.hint || ''
    const errorCode = error?.code || ''
    return NextResponse.json(
      { 
        error: `${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}${errorCode ? ` [${errorCode}]` : ''}`,
      },
      { status: 500 }
    )
  }
}

// Helper function to create exercises for a workout
async function createExercises(supabaseAdmin: any, workoutId: string, exercises: any[]) {
  if (!exercises || exercises.length === 0) return

  for (const exercise of exercises) {
    // Look up exercise_uuid from exercises table
    const { data: exerciseRef } = await supabaseAdmin
      .from('exercises')
      .select('id')
      .eq('name', exercise.exerciseName)
      .single()
    
    const { data: exerciseData, error: exerciseError } = await supabaseAdmin
      .from('workout_exercises')
      .insert({
        workout_id: workoutId,
        exercise_id: exercise.exerciseId,
        exercise_name: exercise.exerciseName,
        exercise_uuid: exerciseRef?.id || null,
        category: exercise.category || 'strength',
        order_index: exercise.order,
        notes: exercise.notes || null,
        superset_group: exercise.supersetGroup || null,
      })
      .select()
      .single()

    if (exerciseError) {
      console.error('Exercise insert error:', exerciseError)
      throw exerciseError
    }

    // Create exercise sets
    if (exercise.sets?.length > 0 && exerciseData) {
      const setsToInsert = exercise.sets.map((set: any) => ({
        exercise_id: exerciseData.id,
        set_number: set.setNumber,
        reps: set.reps,
        intensity_type: set.intensityType,
        intensity_value: set.intensityValue,
        rest_seconds: set.restSeconds,
        rest_bracket: set.restBracket || '90-120',
        weight_type: set.weightType || 'freeweight',
        notes: set.notes || null,
        cardio_type: set.cardioType || null,
        cardio_value: set.cardioValue || null,
        cardio_unit: set.cardioUnit || null,
        heart_rate_zone: set.heartRateZone || null,
        work_time: set.workTime || null,
        rest_time: set.restTime || null,
        hyrox_station: set.hyroxStation || null,
        hyrox_distance: set.hyroxDistance || null,
        hyrox_unit: set.hyroxUnit || null,
        hyrox_target_time: set.hyroxTargetTime || null,
        hyrox_weight_class: set.hyroxWeightClass || null,
      }))

      const { error: setsError } = await supabaseAdmin
        .from('exercise_sets')
        .insert(setsToInsert)

      if (setsError) {
        console.error('Sets insert error:', setsError)
        throw setsError
      }
    }
  }
}

// Helper function to create a finisher
async function createFinisher(supabaseAdmin: any, programId: string, parentWorkoutId: string, finisher: any) {
  const { data: finisherData, error: finisherError } = await supabaseAdmin
    .from('program_workouts')
    .insert({
      program_id: programId,
      parent_workout_id: parentWorkoutId,
      name: finisher.name,
      category: finisher.category,
      order_index: 0,
      notes: finisher.notes || null,
      is_emom: finisher.isEmom || false,
      emom_interval: finisher.emomInterval || null,
      is_superset: finisher.isSuperset || false,
    })
    .select()
    .single()

  if (finisherError) {
    console.error('Finisher insert error:', finisherError)
    throw finisherError
  }

  // Create finisher exercises
  await createExercises(supabaseAdmin, finisherData.id, finisher.exercises)
}
