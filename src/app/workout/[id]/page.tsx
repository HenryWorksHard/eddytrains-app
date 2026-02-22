import { createClient } from '../../lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import BottomNav from '../../components/BottomNav'
import BackButton from '../../components/BackButton'
import CompleteWorkoutButton from './CompleteWorkoutButton'
import WorkoutClient from './WorkoutClient'

// Cache for 30 seconds
export const revalidate = 30

interface ExerciseSet {
  set_number: number
  reps: string
  intensity_type: string
  intensity_value: string
  rest_bracket?: string
  rest_seconds?: number
  weight_type?: string
  notes?: string
  is_custom?: boolean
  cardio_type?: string
  cardio_value?: string
  cardio_unit?: string
  heart_rate_zone?: string
  hyrox_station?: string
  hyrox_distance?: number
  hyrox_unit?: string
  hyrox_target_time?: string
  hyrox_weight_class?: string
}

interface WorkoutExercise {
  id: string
  exercise_id: string
  exercise_name: string
  order_index: number
  notes?: string
  superset_group?: string
  sets: ExerciseSet[]
  tutorial_url?: string
  tutorial_steps?: string[]
}

interface Client1RM {
  exercise_name: string
  weight_kg: number
}

function find1RM(exerciseName: string, oneRMs: Client1RM[]): number | null {
  const normalizedName = exerciseName.toLowerCase().trim()
  
  const direct = oneRMs.find(rm => rm.exercise_name.toLowerCase() === normalizedName)
  if (direct && direct.weight_kg > 0) return direct.weight_kg
  
  const matchMap: Record<string, string[]> = {
    'squat': ['squat', 'back squat', 'barbell squat'],
    'bench press': ['bench', 'bench press', 'flat bench', 'barbell bench'],
    'deadlift': ['deadlift', 'conventional deadlift', 'barbell deadlift'],
    'overhead press': ['ohp', 'overhead press', 'shoulder press', 'military press'],
    'barbell row': ['row', 'barbell row', 'bent over row', 'bb row'],
    'front squat': ['front squat'],
    'romanian deadlift': ['rdl', 'romanian deadlift', 'stiff leg deadlift'],
    'incline bench press': ['incline bench', 'incline press', 'incline bench press'],
  }
  
  for (const [key, aliases] of Object.entries(matchMap)) {
    if (aliases.some(alias => normalizedName.includes(alias))) {
      const rm = oneRMs.find(r => r.exercise_name.toLowerCase() === key)
      if (rm && rm.weight_kg > 0) return rm.weight_kg
    }
  }
  
  return null
}

export default async function WorkoutDetailPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ id: string }>
  searchParams: Promise<{ clientProgramId?: string; scheduledDate?: string }>
}) {
  const { id: workoutId } = await params
  const { clientProgramId, scheduledDate } = await searchParams
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const today = new Date().toISOString().split('T')[0]

  // PHASE 1: Run all independent queries in parallel
  const [
    completionResult,
    oneRMsResult,
    workoutLogsResult,
    workoutResult,
    finishersResult,
    customSetsResult
  ] = await Promise.all([
    // Today's completion check
    (async () => {
      let query = supabase
        .from('workout_completions')
        .select('id')
        .eq('client_id', user.id)
        .eq('workout_id', workoutId)
        .eq('scheduled_date', today)
      
      if (clientProgramId) {
        query = query.eq('client_program_id', clientProgramId)
      }
      return query.single()
    })(),
    
    // User's 1RMs
    supabase
      .from('client_1rms')
      .select('exercise_name, weight_kg')
      .eq('client_id', user.id),
    
    // Workout logs for PB calculation
    supabase
      .from('workout_logs')
      .select('id')
      .eq('client_id', user.id),
    
    // Main workout with exercises
    supabase
      .from('program_workouts')
      .select(`
        id,
        name,
        day_of_week,
        notes,
        program_id,
        is_emom,
        emom_interval,
        programs (id, name, emoji),
        workout_exercises (
          id,
          exercise_id,
          exercise_name,
          exercise_uuid,
          order_index,
          notes,
          superset_group,
          exercises:exercise_uuid (id, name, tutorial_url, tutorial_steps, muscle_group, category),
          exercise_sets (
            id, set_number, reps, intensity_type, intensity_value, rest_seconds, rest_bracket,
            weight_type, notes, cardio_type, cardio_value, cardio_unit, heart_rate_zone
          )
        )
      `)
      .eq('id', workoutId)
      .single(),
    
    // Finisher workouts
    supabase
      .from('program_workouts')
      .select(`
        id, name, category, is_emom, emom_interval, is_superset,
        workout_exercises (
          id, exercise_id, exercise_name, exercise_uuid, order_index, notes, superset_group,
          exercises:exercise_uuid (id, name, tutorial_url, tutorial_steps),
          exercise_sets (
            id, set_number, reps, intensity_type, intensity_value, rest_seconds, notes,
            cardio_type, cardio_value, cardio_unit, heart_rate_zone,
            hyrox_station, hyrox_distance, hyrox_unit, hyrox_target_time, hyrox_weight_class
          )
        )
      `)
      .eq('parent_workout_id', workoutId),
    
    // Custom exercise sets (if clientProgramId provided)
    clientProgramId 
      ? supabase.from('client_exercise_sets').select('*').eq('client_program_id', clientProgramId)
      : Promise.resolve({ data: null })
  ])

  const isCompletedToday = !!completionResult.data
  const oneRMs: Client1RM[] = oneRMsResult.data || []
  const workout = workoutResult.data
  const finisherWorkouts = finishersResult.data

  if (!workout) {
    notFound()
  }

  // PHASE 2: Calculate personal bests (needs workout logs)
  let personalBests: { exercise_name: string; weight_kg: number; reps: number }[] = []
  
  const workoutLogIds = workoutLogsResult.data?.map(log => log.id) || []
  if (workoutLogIds.length > 0) {
    const [setLogsResult, exercisesResult] = await Promise.all([
      supabase
        .from('set_logs')
        .select('exercise_id, weight_kg, reps_completed')
        .in('workout_log_id', workoutLogIds)
        .not('weight_kg', 'is', null)
        .not('reps_completed', 'is', null),
      supabase
        .from('workout_exercises')
        .select('id, exercise_name')
    ])
    
    const allSetLogs = setLogsResult.data || []
    const exerciseNameLookup = new Map(exercisesResult.data?.map(e => [e.id, e.exercise_name]) || [])
    
    const personalBestsMap = new Map<string, { weight_kg: number; reps: number; estimated1RM: number }>()
    
    allSetLogs.forEach(log => {
      const exerciseName = exerciseNameLookup.get(log.exercise_id)
      if (!exerciseName || !log.weight_kg || !log.reps_completed) return
      
      const estimated1RM = log.weight_kg * (1 + log.reps_completed / 30)
      const key = exerciseName.toLowerCase()
      
      const existing = personalBestsMap.get(key)
      if (!existing || estimated1RM > existing.estimated1RM) {
        personalBestsMap.set(key, { weight_kg: log.weight_kg, reps: log.reps_completed, estimated1RM })
      }
    })
    
    personalBests = Array.from(personalBestsMap.entries()).map(([name, data]) => ({
      exercise_name: name,
      weight_kg: data.weight_kg,
      reps: data.reps
    }))
  }

  // Process custom sets
  const customSets: Record<string, ExerciseSet[]> = {}
  if (customSetsResult.data) {
    customSetsResult.data.forEach((set: any) => {
      const key = set.workout_exercise_id
      if (!customSets[key]) customSets[key] = []
      customSets[key].push({
        set_number: set.set_number,
        reps: set.reps,
        intensity_type: set.intensity_type,
        intensity_value: set.intensity_value,
        rest_bracket: set.rest_bracket,
        weight_type: set.weight_type,
        notes: set.notes,
        is_custom: true
      })
    })
  }

  // Process exercises
  const exercises: WorkoutExercise[] = ((workout.workout_exercises as unknown) as WorkoutExercise[] || [])
    .sort((a, b) => a.order_index - b.order_index)
    .map(exercise => {
      const exerciseCustomSets = customSets[exercise.id]
      const joinedExercise = (exercise as any).exercises
      const exerciseName = joinedExercise?.name || exercise.exercise_name
      
      let sets: ExerciseSet[]
      if (exerciseCustomSets && exerciseCustomSets.length > 0) {
        sets = exerciseCustomSets.sort((a, b) => a.set_number - b.set_number)
      } else {
        sets = ((exercise as unknown as { exercise_sets: ExerciseSet[] }).exercise_sets || [])
          .sort((a: ExerciseSet, b: ExerciseSet) => a.set_number - b.set_number)
          .map((s: ExerciseSet) => ({
            ...s,
            rest_bracket: s.rest_bracket || `${s.rest_seconds || 90}`,
            is_custom: false
          }))
      }
      
      return {
        ...exercise,
        exercise_name: exerciseName,
        sets,
        tutorial_url: joinedExercise?.tutorial_url || exercise.tutorial_url,
        tutorial_steps: joinedExercise?.tutorial_steps || exercise.tutorial_steps
      }
    })

  // Process finishers
  interface Finisher {
    id: string
    name: string
    category: string
    isEmom: boolean
    emomInterval: number | null
    isSuperset: boolean
    exercises: WorkoutExercise[]
  }

  const finishers: Finisher[] = (finisherWorkouts || []).map(finisher => {
    const finisherExercises: WorkoutExercise[] = ((finisher.workout_exercises as unknown) as WorkoutExercise[] || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map(exercise => {
        const joinedExercise = (exercise as any).exercises
        const exerciseName = joinedExercise?.name || exercise.exercise_name
        const sets = ((exercise as unknown as { exercise_sets: ExerciseSet[] }).exercise_sets || [])
          .sort((a: ExerciseSet, b: ExerciseSet) => a.set_number - b.set_number)
          .map((s: ExerciseSet) => ({
            ...s,
            rest_bracket: s.rest_bracket || `${s.rest_seconds || 90}`,
            is_custom: false
          }))
        
        return {
          ...exercise,
          exercise_name: exerciseName,
          sets,
          tutorial_url: joinedExercise?.tutorial_url,
          tutorial_steps: joinedExercise?.tutorial_steps
        }
      })

    return {
      id: finisher.id,
      name: finisher.name,
      category: finisher.category || 'strength',
      isEmom: finisher.is_emom || false,
      emomInterval: finisher.emom_interval,
      isSuperset: finisher.is_superset || false,
      exercises: finisherExercises
    }
  })

  const programData = workout.programs as { id: string; name: string; emoji?: string }[] | { id: string; name: string; emoji?: string } | null
  const program = Array.isArray(programData) ? programData[0] : programData

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <header className="bg-gradient-to-b from-zinc-900 to-black border-b border-zinc-800">
        <div className="px-6 py-4">
          <BackButton className="mb-2" />
        </div>
        <div className="px-6 pb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-yellow-400/20 rounded-2xl flex items-center justify-center">
              <span className="text-yellow-400 font-bold text-xl">
                {workout.day_of_week !== null 
                  ? ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][workout.day_of_week]
                  : '—'}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">{workout.name}</h1>
              <p className="text-zinc-400 text-sm mt-1">{program?.name}</p>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-zinc-500 text-sm">{exercises.length} exercises</p>
                {workout.is_emom && (
                  <span className="px-2 py-0.5 bg-yellow-400/20 text-yellow-400 text-xs font-semibold rounded-full">
                    EMOM {workout.emom_interval ? `${workout.emom_interval >= 60 ? `${workout.emom_interval / 60}min` : `${workout.emom_interval}s`}` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        {exercises.length > 0 ? (
          <WorkoutClient
            workoutId={workoutId}
            exercises={exercises}
            oneRMs={oneRMs}
            personalBests={personalBests}
            clientProgramId={clientProgramId}
            scheduledDate={scheduledDate}
            finishers={finishers}
          />
        ) : workout.notes ? (
          /* Active Rest / Notes-only workout */
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                <span className="text-green-400 text-lg">📋</span>
              </div>
              <h3 className="text-white font-semibold">Instructions</h3>
            </div>
            <div className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">
              {workout.notes}
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-zinc-600">?</span>
            </div>
            <h3 className="text-white font-semibold mb-2">No Exercises Yet</h3>
            <p className="text-zinc-400 text-sm">
              Your coach will add exercises to this workout soon.
            </p>
          </div>
        )}
        
        {exercises.length > 0 && <div className="h-24" />}
        {exercises.length > 0 && <div id="workout-end-sentinel" className="h-1" />}
      </main>

      {(exercises.length > 0 || workout.notes) && workout.day_of_week === new Date().getDay() && (
        <CompleteWorkoutButton 
          workoutId={workoutId}
          clientProgramId={clientProgramId}
          scheduledDate={scheduledDate}
          isCompleted={isCompletedToday}
        />
      )}

      <BottomNav />
    </div>
  )
}
