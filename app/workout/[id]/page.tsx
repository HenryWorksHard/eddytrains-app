import { createClient } from '../../lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import BottomNav from '../../components/BottomNav'
import BackButton from '../../components/BackButton'
import CompleteWorkoutButton from './CompleteWorkoutButton'
import WorkoutClient from './WorkoutClient'

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

// Helper to match exercise names to 1RMs
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

// Summarize sets into a single display
function summarizeSets(sets: ExerciseSet[]) {
  if (sets.length === 0) return { setCount: 0, reps: '-', intensity: '-', intensityType: '' }
  
  const setCount = sets.length
  
  // Get unique rep values
  const repValues = [...new Set(sets.map(s => s.reps))]
  const reps = repValues.length === 1 ? repValues[0] : `${sets[0].reps}`
  
  // Get intensity (assume all same type)
  const intensityType = sets[0].intensity_type
  const intensityValues = [...new Set(sets.map(s => s.intensity_value))]
  const intensity = intensityValues.length === 1 ? intensityValues[0] : intensityValues.join('-')
  
  return { setCount, reps, intensity, intensityType }
}

export default async function WorkoutDetailPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ id: string }>
  searchParams: Promise<{ clientProgramId?: string }>
}) {
  const { id: workoutId } = await params
  const { clientProgramId } = await searchParams
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Check if workout is already completed today for this specific program assignment
  const today = new Date().toISOString().split('T')[0]
  let completionQuery = supabase
    .from('workout_completions')
    .select('id')
    .eq('client_id', user.id)
    .eq('workout_id', workoutId)
    .eq('scheduled_date', today)
  
  // If we have a clientProgramId, only check completions for this assignment
  if (clientProgramId) {
    completionQuery = completionQuery.eq('client_program_id', clientProgramId)
  }
  
  const { data: todayCompletion } = await completionQuery.single()
  
  const isCompletedToday = !!todayCompletion

  // Fetch user's 1RMs
  const { data: userOneRMs } = await supabase
    .from('client_1rms')
    .select('exercise_name, weight_kg')
    .eq('client_id', user.id)
  
  const oneRMs: Client1RM[] = userOneRMs || []

  // Fetch the workout with its exercises
  const { data: workout, error: workoutError } = await supabase
    .from('program_workouts')
    .select(`
      id,
      name,
      day_of_week,
      notes,
      program_id,
      is_emom,
      emom_interval,
      programs (
        id,
        name,
        emoji
      ),
      workout_exercises (
        id,
        exercise_id,
        exercise_name,
        order_index,
        notes,
        superset_group,
        exercise_sets (
          id,
          set_number,
          reps,
          intensity_type,
          intensity_value,
          rest_seconds,
          notes
        )
      )
    `)
    .eq('id', workoutId)
    .single()

  if (workoutError) {
    console.error('Workout fetch error:', workoutError, 'workoutId:', workoutId)
  }

  if (!workout) {
    console.error('Workout not found for ID:', workoutId)
    notFound()
  }

  // Try to fetch exercise tutorials from exercises table
  const exerciseNames = ((workout.workout_exercises as unknown) as { exercise_name: string }[] || [])
    .map(e => e.exercise_name)
  
  const { data: exerciseData } = await supabase
    .from('exercises')
    .select('name, tutorial_url, tutorial_steps')
    .in('name', exerciseNames)
  
  const tutorialMap = new Map(
    (exerciseData || []).map(e => [e.name.toLowerCase(), { url: e.tutorial_url, steps: e.tutorial_steps }])
  )

  // If we have a clientProgramId, fetch custom exercise sets
  let customSets: Record<string, ExerciseSet[]> = {}
  
  if (clientProgramId) {
    const { data: clientExerciseSets } = await supabase
      .from('client_exercise_sets')
      .select('*')
      .eq('client_program_id', clientProgramId)
    
    if (clientExerciseSets) {
      clientExerciseSets.forEach(set => {
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
  }

  // Merge exercises with custom sets and tutorials
  const exercises: WorkoutExercise[] = ((workout.workout_exercises as unknown) as WorkoutExercise[] || [])
    .sort((a, b) => a.order_index - b.order_index)
    .map(exercise => {
      const exerciseCustomSets = customSets[exercise.id]
      const tutorial = tutorialMap.get(exercise.exercise_name.toLowerCase())
      
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
        sets,
        tutorial_url: tutorial?.url,
        tutorial_steps: tutorial?.steps
      }
    })

  const programData = workout.programs as { id: string; name: string; emoji?: string }[] | { id: string; name: string; emoji?: string } | null
  const program = Array.isArray(programData) ? programData[0] : programData

  // Format intensity display
  const formatIntensity = (type: string, value: string) => {
    switch (type) {
      case 'rir': return `${value} RIR`
      case 'rpe': return `RPE ${value}`
      case 'percentage': return `${value}%`
      case 'failure': return 'To Failure'
      default: return value
    }
  }

  // Calculate weight from percentage
  const calculateWeight = (type: string, value: string, exerciseName: string) => {
    if (type !== 'percentage') return null
    const percentage = parseFloat(value)
    const oneRM = find1RM(exerciseName, oneRMs)
    if (!oneRM || isNaN(percentage)) return null
    return Math.round((oneRM * percentage / 100) * 2) / 2 // Round to 0.5kg
  }

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <header className="bg-gradient-to-b from-zinc-900 to-black border-b border-zinc-800">
        <div className="px-6 py-4">
          <BackButton className="mb-2" />
        </div>
        <div className="px-6 pb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center text-3xl">
              
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
            clientProgramId={clientProgramId}
          />
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
        
        {/* Spacer for Complete Workout button */}
        {exercises.length > 0 && (
          <div className="h-24" />
        )}
        
        {/* Sentinel for scroll detection */}
        {exercises.length > 0 && (
          <div id="workout-end-sentinel" className="h-1" />
        )}
      </main>

      {/* Complete Workout Button - only shows for today's workout */}
      {exercises.length > 0 && workout.day_of_week === new Date().getDay() && (
        <CompleteWorkoutButton 
          workoutId={workoutId}
          clientProgramId={clientProgramId}
          isCompleted={isCompletedToday}
        />
      )}

      <BottomNav />
    </div>
  )
}
