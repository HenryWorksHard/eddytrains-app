import { createClient } from '../../lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import BottomNav from '../../components/BottomNav'
import Link from 'next/link'

interface ExerciseSet {
  set_number: number
  reps: string
  intensity_type: string
  intensity_value: string
  rest_bracket?: string
  rest_seconds?: number
  weight_type?: string
  notes?: string
  // Flag to indicate if this is a custom value
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

  // Fetch the workout with its exercises
  const { data: workout } = await supabase
    .from('program_workouts')
    .select(`
      id,
      name,
      day_of_week,
      notes,
      program_id,
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

  if (!workout) {
    notFound()
  }

  // If we have a clientProgramId, fetch custom exercise sets
  let customSets: Record<string, ExerciseSet[]> = {}
  
  if (clientProgramId) {
    const { data: clientExerciseSets } = await supabase
      .from('client_exercise_sets')
      .select('*')
      .eq('client_program_id', clientProgramId)
    
    if (clientExerciseSets) {
      // Group by workout_exercise_id
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

  // Merge exercises with custom sets
  const exercises: WorkoutExercise[] = ((workout.workout_exercises as unknown) as WorkoutExercise[] || [])
    .sort((a, b) => a.order_index - b.order_index)
    .map(exercise => {
      // Check if we have custom sets for this exercise
      const exerciseCustomSets = customSets[exercise.id]
      
      let sets: ExerciseSet[]
      if (exerciseCustomSets && exerciseCustomSets.length > 0) {
        // Use custom sets
        sets = exerciseCustomSets.sort((a, b) => a.set_number - b.set_number)
      } else {
        // Fall back to default exercise sets
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
        sets
      }
    })

  const program = workout.programs as { id: string; name: string; emoji?: string } | null
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const formatIntensity = (type: string, value: string) => {
    switch (type) {
      case 'rir':
        return `${value} RIR`
      case 'rpe':
        return `RPE ${value}`
      case 'percentage':
        return `${value}%`
      default:
        return value
    }
  }

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <header className="bg-gradient-to-b from-zinc-900 to-black border-b border-zinc-800">
        <div className="px-6 py-4">
          <Link href="/programs" className="text-yellow-400 text-sm font-medium mb-2 inline-block">
            ← Back to Program
          </Link>
        </div>
        <div className="px-6 pb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center text-3xl">
              {program?.emoji || '💪'}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">{workout.name}</h1>
              {workout.day_of_week !== null && (
                <span className="inline-block mt-2 px-3 py-1 bg-yellow-400/10 text-yellow-400 text-xs font-medium rounded-full">
                  {daysOfWeek[workout.day_of_week]}
                </span>
              )}
            </div>
          </div>
          {workout.notes && (
            <p className="text-zinc-400 mt-4 text-sm">{workout.notes}</p>
          )}
        </div>
      </header>

      <main className="px-6 py-6 space-y-4">
        {exercises.length > 0 ? (
          exercises.map((exercise, idx) => (
            <div 
              key={exercise.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"
            >
              {/* Exercise Header */}
              <div className="p-4 border-b border-zinc-800/50">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-yellow-400/10 text-yellow-400 flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{exercise.exercise_name}</h3>
                    {exercise.superset_group && (
                      <span className="text-xs text-zinc-500">Superset {exercise.superset_group}</span>
                    )}
                  </div>
                  {exercise.sets.some(s => s.is_custom) && (
                    <span className="px-2 py-0.5 bg-yellow-400/20 text-yellow-400 text-xs rounded-full">
                      Custom
                    </span>
                  )}
                </div>
              </div>

              {/* Sets Table */}
              <div className="divide-y divide-zinc-800/50">
                {/* Header Row */}
                <div className="grid grid-cols-4 px-4 py-2 text-xs text-zinc-500 uppercase">
                  <span>Set</span>
                  <span>Reps</span>
                  <span>Intensity</span>
                  <span>Rest</span>
                </div>
                
                {/* Set Rows */}
                {exercise.sets.map((set, setIdx) => (
                  <div 
                    key={setIdx}
                    className="grid grid-cols-4 px-4 py-3 items-center"
                  >
                    <span className="text-zinc-400 font-mono">{set.set_number}</span>
                    <span className="text-white font-medium">{set.reps}</span>
                    <span className="text-yellow-400 text-sm">
                      {formatIntensity(set.intensity_type, set.intensity_value)}
                    </span>
                    <span className="text-zinc-400 text-sm">{set.rest_bracket || set.rest_seconds}s</span>
                  </div>
                ))}
              </div>

              {/* Exercise Notes */}
              {exercise.notes && (
                <div className="px-4 py-3 bg-zinc-800/30 border-t border-zinc-800/50">
                  <p className="text-zinc-400 text-sm">{exercise.notes}</p>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-white font-semibold mb-2">No Exercises Yet</h3>
            <p className="text-zinc-400 text-sm">
              Your coach will add exercises to this workout soon.
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
