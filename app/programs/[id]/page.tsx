import { createClient } from '../../lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import BottomNav from '../../components/BottomNav'
import Link from 'next/link'

interface ExerciseSet {
  id: string
  set_number: number
  reps: string
  intensity_type: string
  intensity_value: string
  rest_bracket?: string
  weight_type?: string
}

interface WorkoutExercise {
  id: string
  exercise_name: string
  order_index: number
  notes?: string
  superset_group?: string
  exercise_sets?: ExerciseSet[]
}

// Group exercises by superset
function groupExercises(exercises: WorkoutExercise[]) {
  const groups: { type: 'single' | 'superset'; exercises: WorkoutExercise[]; supersetGroup?: string }[] = []
  const processedSupersets = new Set<string>()

  const sortedExercises = [...exercises].sort((a, b) => a.order_index - b.order_index)

  sortedExercises.forEach(exercise => {
    if (exercise.superset_group) {
      if (!processedSupersets.has(exercise.superset_group)) {
        processedSupersets.add(exercise.superset_group)
        const supersetExercises = sortedExercises.filter(ex => ex.superset_group === exercise.superset_group)
        groups.push({ type: 'superset', exercises: supersetExercises, supersetGroup: exercise.superset_group })
      }
    } else {
      groups.push({ type: 'single', exercises: [exercise] })
    }
  })

  return groups
}

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Check user has access to this program via client_programs
  const { data: clientProgram } = await supabase
    .from('client_programs')
    .select(`
      *,
      programs (
        id,
        name,
        description,
        category,
        difficulty,
        duration_weeks
      )
    `)
    .eq('client_id', user.id)
    .eq('program_id', id)
    .eq('is_active', true)
    .single()

  if (!clientProgram) {
    notFound()
  }

  const program = clientProgram.programs as {
    id: string
    name: string
    description?: string
    category?: string
    difficulty?: string
    duration_weeks?: number
  }

  // Get workouts for this program with exercises
  const { data: workouts } = await supabase
    .from('program_workouts')
    .select(`
      id,
      name,
      day_of_week,
      order_index,
      notes,
      workout_exercises (
        id,
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
          rest_bracket,
          weight_type
        )
      )
    `)
    .eq('program_id', id)
    .order('order_index')

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const renderExercise = (exercise: WorkoutExercise, isSuperset: boolean = false) => (
    <div key={exercise.id} className={`p-4 ${isSuperset ? '' : ''}`}>
      <h3 className={`font-medium ${isSuperset ? 'text-yellow-400' : 'text-white'}`}>
        {exercise.exercise_name}
      </h3>
      {exercise.notes && (
        <p className="text-zinc-500 text-xs mt-1">{exercise.notes}</p>
      )}
      
      {/* Sets */}
      {exercise.exercise_sets && exercise.exercise_sets.length > 0 && (
        <div className="mt-3 space-y-2">
          {exercise.exercise_sets
            .sort((a, b) => a.set_number - b.set_number)
            .map((set) => (
            <div key={set.id} className="flex items-center gap-3 text-sm">
              <span className={`w-6 h-6 rounded flex items-center justify-center text-xs ${
                isSuperset 
                  ? 'bg-yellow-400/20 text-yellow-400' 
                  : 'bg-zinc-800 text-zinc-400'
              }`}>
                {set.set_number}
              </span>
              <span className="text-white">{set.reps} reps</span>
              <span className="text-zinc-500">
                {set.intensity_type === 'percentage' ? `${set.intensity_value}%` : 
                 set.intensity_type === 'rir' ? `${set.intensity_value} RIR` :
                 set.intensity_type === 'rpe' ? `RPE ${set.intensity_value}` : 
                 set.intensity_type === 'time' ? `${set.intensity_value}s` :
                 set.intensity_type === 'failure' ? 'To Failure' :
                 set.intensity_value}
              </span>
              {set.rest_bracket && (
                <span className="text-zinc-600 text-xs">{set.rest_bracket}s rest</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-black pb-32">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="px-6 py-4">
          <Link href="/programs" className="text-yellow-400 text-sm font-medium mb-2 inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>
        <div className="px-6 pb-6">
          <h1 className="text-2xl font-bold text-white">{program?.name || 'Program'}</h1>
          {program?.description && (
            <p className="text-zinc-400 mt-2 text-sm">{program.description}</p>
          )}
          <div className="flex gap-2 mt-3">
            {program?.category && (
              <span className="px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded-lg capitalize">
                {program.category}
              </span>
            )}
            {program?.difficulty && (
              <span className="px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded-lg capitalize">
                {program.difficulty}
              </span>
            )}
            {program?.duration_weeks && (
              <span className="px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded-lg">
                {program.duration_weeks} weeks
              </span>
            )}
          </div>
          {clientProgram.phase_name && (
            <div className="mt-3 px-3 py-2 bg-yellow-400/10 border border-yellow-400/20 rounded-lg">
              <p className="text-yellow-400 text-sm font-medium">{clientProgram.phase_name}</p>
            </div>
          )}
        </div>
      </header>

      <main className="px-6 py-6 space-y-6">
        {/* Workouts */}
        {workouts && workouts.length > 0 ? (
          workouts.map((workout) => {
            const exerciseGroups = groupExercises(workout.workout_exercises as WorkoutExercise[] || [])
            
            return (
              <div key={workout.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                {/* Workout Header */}
                <div className="p-4 border-b border-zinc-800">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">{workout.name}</h2>
                    {workout.day_of_week !== null && (
                      <span className="text-yellow-400 text-sm">
                        {dayNames[workout.day_of_week]}
                      </span>
                    )}
                  </div>
                  {workout.notes && (
                    <p className="text-zinc-500 text-sm mt-1">{workout.notes}</p>
                  )}
                </div>

                {/* Exercises - grouped by superset */}
                <div className="divide-y divide-zinc-800/50">
                  {exerciseGroups.map((group, groupIndex) => {
                    if (group.type === 'superset') {
                      return (
                        <div 
                          key={group.supersetGroup} 
                          className="bg-yellow-400/5 border-l-4 border-yellow-400"
                        >
                          {/* Superset Header */}
                          <div className="px-4 py-2 bg-yellow-400/10 flex items-center gap-2">
                            <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            <span className="text-sm font-medium text-yellow-400">
                              Superset
                            </span>
                          </div>
                          
                          {/* Superset Exercises */}
                          <div className="divide-y divide-yellow-400/10">
                            {group.exercises.map((exercise) => renderExercise(exercise, true))}
                          </div>
                        </div>
                      )
                    } else {
                      return renderExercise(group.exercises[0], false)
                    }
                  })}
                </div>
              </div>
            )
          })
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <p className="text-zinc-400">No workouts in this program yet.</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
