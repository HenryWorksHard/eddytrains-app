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
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.role || !['admin', 'trainer', 'super_admin', 'company_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!profile.organization_id) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }

    const body = await request.json()
    const { name, description, category, difficulty, durationWeeks, isActive, workouts } = body

    // 1. Create the program with organization_id
    const { data: program, error: programError } = await supabaseAdmin
      .from('programs')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        category,
        difficulty,
        duration_weeks: durationWeeks || 4,
        is_active: isActive,
        organization_id: profile.organization_id,
      })
      .select()
      .single()

    if (programError) {
      console.error('Program create error:', programError)
      throw programError
    }

    // 2. Create workouts
    if (workouts && workouts.length > 0 && program) {
      for (const workout of workouts) {
        const { data: workoutData, error: workoutError } = await supabaseAdmin
          .from('program_workouts')
          .insert({
            program_id: program.id,
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

        // 3. Create workout exercises
        if (workout.exercises?.length > 0 && workoutData) {
          for (const exercise of workout.exercises) {
            // Look up exercise_uuid from exercises table
            const { data: exerciseRef } = await supabaseAdmin
              .from('exercises')
              .select('id')
              .eq('name', exercise.exerciseName)
              .single()
            
            const { data: exerciseData, error: exerciseError } = await supabaseAdmin
              .from('workout_exercises')
              .insert({
                workout_id: workoutData.id,
                exercise_id: exercise.exerciseId,
                exercise_name: exercise.exerciseName,
                exercise_uuid: exerciseRef?.id || null, // FK to exercises table
                category: exercise.category || 'strength', // Save exercise category
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

            // 4. Create exercise sets
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
                // Cardio fields
                cardio_type: set.cardioType || null,
                cardio_value: set.cardioValue || null,
                cardio_unit: set.cardioUnit || null,
                heart_rate_zone: set.heartRateZone || null,
                work_time: set.workTime || null,
                rest_time: set.restTime || null,
                // Hyrox fields
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

        // 5. Create finisher (sub-workout) if exists
        if (workout.finisher && workoutData) {
          const { data: finisherData, error: finisherError } = await supabaseAdmin
            .from('program_workouts')
            .insert({
              program_id: program.id,
              parent_workout_id: workoutData.id,
              name: workout.finisher.name,
              category: workout.finisher.category,
              order_index: 0,
              notes: workout.finisher.notes || null,
              is_emom: workout.finisher.isEmom || false,
              emom_interval: workout.finisher.emomInterval || null,
              is_superset: workout.finisher.isSuperset || false,
            })
            .select()
            .single()

          if (finisherError) {
            console.error('Finisher insert error:', finisherError)
            throw finisherError
          }

          // Create finisher exercises
          if (workout.finisher.exercises?.length > 0 && finisherData) {
            for (const exercise of workout.finisher.exercises) {
              // Look up exercise_uuid from exercises table
              const { data: exerciseRef } = await supabaseAdmin
                .from('exercises')
                .select('id')
                .eq('name', exercise.exerciseName)
                .single()
              
              const { data: exerciseData, error: exerciseError } = await supabaseAdmin
                .from('workout_exercises')
                .insert({
                  workout_id: finisherData.id,
                  exercise_id: exercise.exerciseId,
                  exercise_name: exercise.exerciseName,
                  exercise_uuid: exerciseRef?.id || null, // FK to exercises table
                  category: exercise.category || 'strength', // Save exercise category
                  order_index: exercise.order,
                  notes: exercise.notes || null,
                })
                .select()
                .single()

              if (exerciseError) {
                console.error('Finisher exercise insert error:', exerciseError)
                throw exerciseError
              }

              // Create finisher exercise sets
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
                  // Cardio fields
                  cardio_type: set.cardioType || null,
                  cardio_value: set.cardioValue || null,
                  cardio_unit: set.cardioUnit || null,
                  heart_rate_zone: set.heartRateZone || null,
                  work_time: set.workTime || null,
                  rest_time: set.restTime || null,
                  // Hyrox fields
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
                  console.error('Finisher sets insert error:', setsError)
                  throw setsError
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, programId: program.id })

  } catch (error) {
    console.error('Error creating program:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create program' },
      { status: 500 }
    )
  }
}
