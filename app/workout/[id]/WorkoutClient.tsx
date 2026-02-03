'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../lib/supabase/client'
import ExerciseCard from './ExerciseCard'

interface ExerciseSet {
  set_number: number
  reps: string
  intensity_type: string
  intensity_value: string
  rest_bracket?: string
  notes?: string
}

interface WorkoutExercise {
  id: string
  exercise_name: string
  order_index: number
  notes?: string
  superset_group?: string
  sets: ExerciseSet[]
  tutorial_url?: string
  tutorial_steps?: string[]
}

interface SetLog {
  exercise_id: string
  set_number: number
  weight_kg: number | null
  reps_completed: number | null
}

interface PreviousSetLog {
  exercise_id: string
  set_number: number
  weight_kg: number
  reps_completed: number
}

// Group exercises by superset
function groupExercises(exercises: WorkoutExercise[]) {
  const groups: { type: 'single' | 'superset'; exercises: WorkoutExercise[]; supersetGroup?: string }[] = []
  const processedSupersets = new Set<string>()

  exercises.forEach(exercise => {
    if (exercise.superset_group) {
      if (!processedSupersets.has(exercise.superset_group)) {
        processedSupersets.add(exercise.superset_group)
        const supersetExercises = exercises.filter(ex => ex.superset_group === exercise.superset_group)
        groups.push({ type: 'superset', exercises: supersetExercises, supersetGroup: exercise.superset_group })
      }
    } else {
      groups.push({ type: 'single', exercises: [exercise] })
    }
  })

  return groups
}

interface SwappedExercise {
  exerciseId: string
  newName: string
  isCustom: boolean
}

interface WorkoutClientProps {
  workoutId: string
  exercises: WorkoutExercise[]
  oneRMs: { exercise_name: string; weight_kg: number }[]
  clientProgramId?: string
}

// Helper to match exercise names to 1RMs
function find1RM(exerciseName: string, oneRMs: { exercise_name: string; weight_kg: number }[]): number | null {
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

// Calculate weight from percentage
function calculateWeight(type: string, value: string, oneRM: number | null): number | null {
  if (type !== 'percentage' || !oneRM) return null
  const percentage = parseFloat(value)
  if (isNaN(percentage)) return null
  return Math.round((oneRM * percentage / 100) * 2) / 2 // Round to 0.5kg
}

// Format intensity display
function formatIntensity(type: string, value: string) {
  switch (type) {
    case 'rir': return `${value} RIR`
    case 'rpe': return `RPE ${value}`
    case 'percentage': return `${value}%`
    case 'failure': return 'To Failure'
    default: return value
  }
}

export default function WorkoutClient({ workoutId, exercises, oneRMs, clientProgramId }: WorkoutClientProps) {
  const [setLogs, setSetLogs] = useState<Map<string, SetLog>>(new Map())
  const [previousLogs, setPreviousLogs] = useState<Map<string, PreviousSetLog[]>>(new Map())
  const [saving, setSaving] = useState(false)
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null)
  const [swappedExercises, setSwappedExercises] = useState<Map<string, SwappedExercise>>(new Map())
  const supabase = createClient()

  // Load previous logs for each exercise
  useEffect(() => {
    loadPreviousLogs()
  }, [workoutId])

  const loadPreviousLogs = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get the most recent workout log for this workout
    const { data: recentLog } = await supabase
      .from('workout_logs')
      .select('id')
      .eq('client_id', user.id)
      .eq('workout_id', workoutId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    if (recentLog) {
      // Get set logs for this workout log
      const { data: logs } = await supabase
        .from('set_logs')
        .select('exercise_id, set_number, weight_kg, reps_completed')
        .eq('workout_log_id', recentLog.id)

      if (logs) {
        const logsByExercise = new Map<string, PreviousSetLog[]>()
        logs.forEach(log => {
          const existing = logsByExercise.get(log.exercise_id) || []
          existing.push({
            exercise_id: log.exercise_id,
            set_number: log.set_number,
            weight_kg: log.weight_kg,
            reps_completed: log.reps_completed
          })
          logsByExercise.set(log.exercise_id, existing)
        })
        setPreviousLogs(logsByExercise)
      }
    }
  }

  // Handle log updates from exercise cards
  const handleLogUpdate = useCallback((exerciseId: string, setNumber: number, weight: number | null, reps: number | null) => {
    const key = `${exerciseId}-${setNumber}`
    setSetLogs(prev => {
      const updated = new Map(prev)
      updated.set(key, { exercise_id: exerciseId, set_number: setNumber, weight_kg: weight, reps_completed: reps })
      return updated
    })
    
    // Auto-save with debounce
    debouncedSave()
  }, [])

  // Handle exercise swap
  const handleExerciseSwap = useCallback((exerciseId: string, newExerciseName: string, isCustom: boolean) => {
    setSwappedExercises(prev => {
      const updated = new Map(prev)
      updated.set(exerciseId, { exerciseId, newName: newExerciseName, isCustom })
      return updated
    })
  }, [])

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async () => {
      await saveWorkoutLogs()
    }, 1500),
    [setLogs, workoutLogId]
  )

  const saveWorkoutLogs = async () => {
    if (setLogs.size === 0) return
    
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let logId = workoutLogId

      // Create workout log if doesn't exist
      if (!logId) {
        const { data: newLog, error: logError } = await supabase
          .from('workout_logs')
          .insert({
            client_id: user.id,
            workout_id: workoutId,
            completed_at: new Date().toISOString()
          })
          .select('id')
          .single()

        if (logError) throw logError
        logId = newLog.id
        setWorkoutLogId(logId)
      }

      // Upsert set logs
      const logsToSave = Array.from(setLogs.values())
        .filter(log => log.weight_kg !== null || log.reps_completed !== null)
        .map(log => ({
          workout_log_id: logId,
          exercise_id: log.exercise_id,
          set_number: log.set_number,
          weight_kg: log.weight_kg,
          reps_completed: log.reps_completed
        }))

      if (logsToSave.length > 0) {
        // Delete existing logs for this workout and re-insert
        await supabase
          .from('set_logs')
          .delete()
          .eq('workout_log_id', logId)

        const { error: setError } = await supabase
          .from('set_logs')
          .insert(logsToSave)

        if (setError) throw setError
      }
    } catch (err) {
      console.error('Failed to save workout logs:', err)
    } finally {
      setSaving(false)
    }
  }

  // Get display name for exercise (swapped or original)
  const getExerciseDisplayName = (exercise: WorkoutExercise) => {
    const swapped = swappedExercises.get(exercise.id)
    return swapped ? swapped.newName : exercise.exercise_name
  }

  const exerciseGroups = groupExercises(exercises)

  const renderExerciseCard = (exercise: WorkoutExercise, idx: number, isInSuperset: boolean = false) => {
    const displayName = getExerciseDisplayName(exercise)
    const oneRM = find1RM(displayName, oneRMs)
    const intensityType = exercise.sets[0]?.intensity_type || 'rir'
    const intensityValue = exercise.sets[0]?.intensity_value || '2'
    const calculatedWeight = calculateWeight(intensityType, intensityValue, oneRM)
    const prevLogs = previousLogs.get(exercise.id) || []

    return (
      <ExerciseCard
        key={exercise.id}
        exerciseId={exercise.id}
        exerciseName={exercise.exercise_name}
        index={idx}
        sets={exercise.sets}
        notes={exercise.notes}
        supersetGroup={isInSuperset ? undefined : exercise.superset_group}
        tutorialUrl={exercise.tutorial_url}
        tutorialSteps={exercise.tutorial_steps}
        intensitySummary={formatIntensity(intensityType, intensityValue)}
        calculatedWeight={calculatedWeight}
        previousLogs={prevLogs}
        onLogUpdate={handleLogUpdate}
        onExerciseSwap={handleExerciseSwap}
        workoutExerciseId={exercise.id}
      />
    )
  }

  return (
    <div className="space-y-3">
      {exerciseGroups.map((group, groupIndex) => {
        if (group.type === 'superset') {
          return (
            <div 
              key={group.supersetGroup}
              className="relative border-2 border-yellow-400/50 rounded-2xl overflow-hidden bg-yellow-400/5"
            >
              {/* Superset Label */}
              <div className="absolute top-2 left-3 z-10">
                <span className="text-xs font-medium text-yellow-400 uppercase tracking-wide">
                  Superset
                </span>
              </div>
              
              {/* Superset Exercises */}
              <div className="pt-6 divide-y divide-yellow-400/20">
                {group.exercises.map((exercise, idx) => (
                  <div key={exercise.id} className="px-1 py-1">
                    {renderExerciseCard(exercise, exercises.indexOf(exercise), true)}
                  </div>
                ))}
              </div>
            </div>
          )
        } else {
          const exercise = group.exercises[0]
          return renderExerciseCard(exercise, exercises.indexOf(exercise), false)
        }
      })}
      
      {/* Auto-save indicator */}
      {saving && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-zinc-800 text-zinc-300 px-4 py-2 rounded-full text-sm flex items-center gap-2">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          Saving...
        </div>
      )}
    </div>
  )
}

// Debounce helper
function debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), ms)
  }
}
