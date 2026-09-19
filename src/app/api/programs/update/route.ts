import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized, forbidden, isTrainerRole, getEffectiveOrgIdStrict } from '@/app/lib/auth-guard'

export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()
    if (!isTrainerRole(ctx.role)) return forbidden()

    const body = await request.json()
    const { id, name, description, category, difficulty, durationWeeks, isActive, workouts } = body

    // Assert the target program belongs to caller's effective org.
    const { data: programRow } = await supabaseAdmin
      .from('programs')
      .select('organization_id')
      .eq('id', id)
      .single()
    if (!programRow) return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    const effectiveOrg = await getEffectiveOrgIdStrict(ctx)
    if (ctx.role !== 'super_admin' && programRow.organization_id !== effectiveOrg) {
      return forbidden()
    }

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

      // Reconcile exercises in place. See syncExercises — deleting and
      // recreating them detaches the client's logged sets.
      await syncExercises(supabaseAdmin, workout.id, workout.exercises)

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

          // Same reconciliation for the finisher's exercises.
          await syncExercises(supabaseAdmin, existingFinisher.id, workout.finisher.exercises)
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

/**
 * Reconcile a workout's exercises against what the trainer just submitted,
 * reusing the existing row wherever the exercise is still in the workout.
 *
 * This replaced a delete-and-recreate whose comment claimed "exercises don't
 * have client logs tied to them directly". That was wrong: set_logs.exercise_id
 * references workout_exercises.id. Before the cascade fix a program edit
 * therefore DELETED the client's logged sets. Since that FK became ON DELETE
 * SET NULL the rows survive, but their exercise_id is nulled - so the weights
 * are still in the database and the app can no longer find them. To the client
 * that is indistinguishable from the original bug: "my weights didn't save".
 *
 * Keeping workout_exercises.id stable is what actually fixes it. An exercise
 * still present keeps its row (and every set_log hanging off it); only
 * exercises the trainer genuinely removed are deleted.
 */
async function syncExercises(supabaseAdmin: any, workoutId: string, exercises: any[]) {
  const incoming = exercises || []

  const { data: existingRows } = await supabaseAdmin
    .from('workout_exercises')
    .select('id, exercise_id, order_index')
    .eq('workout_id', workoutId)
    .order('order_index', { ascending: true })

  // The same exercise can legitimately appear twice in one workout, so hold a
  // queue per exercise and pair them up in order rather than by single lookup.
  const reusable = new Map<string, string[]>()
  for (const row of existingRows || []) {
    if (!row.exercise_id) continue
    const key = String(row.exercise_id)
    if (!reusable.has(key)) reusable.set(key, [])
    reusable.get(key)!.push(row.id)
  }

  for (const exercise of incoming) {
    const { data: exerciseRef } = await supabaseAdmin
      .from('exercises')
      .select('id')
      .eq('name', exercise.exerciseName)
      .maybeSingle()

    const payload = {
      workout_id: workoutId,
      exercise_id: exercise.exerciseId,
      exercise_name: exercise.exerciseName,
      exercise_uuid: exerciseRef?.id || null,
      category: exercise.category || 'strength',
      order_index: exercise.order,
      notes: exercise.notes || null,
      superset_group: exercise.supersetGroup || null,
    }

    const key = exercise.exerciseId ? String(exercise.exerciseId) : null
    let rowId: string | undefined = key ? reusable.get(key)?.shift() : undefined

    if (rowId) {
      const { error: updateError } = await supabaseAdmin
        .from('workout_exercises')
        .update(payload)
        .eq('id', rowId)
      if (updateError) {
        console.error('Exercise update error:', updateError)
        throw updateError
      }
      // The prescription sets are replaced wholesale. That is safe: they hang
      // off workout_exercises and cascade, and no client data references them
      // (set_logs point at workout_exercises, not at exercise_sets).
      await supabaseAdmin.from('exercise_sets').delete().eq('exercise_id', rowId)
    } else {
      const { data: created, error: insertError } = await supabaseAdmin
        .from('workout_exercises')
        .insert(payload)
        .select('id')
        .single()
      if (insertError) {
        console.error('Exercise insert error:', insertError)
        throw insertError
      }
      rowId = created.id
    }

    if (exercise.sets?.length > 0 && rowId) {
      const targetId = rowId
      const setsToInsert = exercise.sets.map((set: any) => ({
        exercise_id: targetId,
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

  // Anything left unmatched is an exercise the trainer actually removed.
  const staleIds = Array.from(reusable.values()).flat()
  if (staleIds.length > 0) {
    await supabaseAdmin.from('workout_exercises').delete().in('id', staleIds)
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
