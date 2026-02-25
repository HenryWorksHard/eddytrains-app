'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '../../lib/supabase/client'
import ExerciseCard from './ExerciseCard'

interface ExerciseSet {
  set_number: number
  reps: string
  intensity_type: string
  intensity_value: string
  rest_bracket?: string
  notes?: string
  // Cardio fields
  cardio_type?: string
  cardio_value?: string
  cardio_unit?: string
  heart_rate_zone?: string
  // Hyrox fields
  hyrox_station?: string
  hyrox_distance?: number
  hyrox_unit?: string
  hyrox_target_time?: string
  hyrox_weight_class?: string
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
  swapped_exercise_name?: string | null
}

interface PreviousSetLog {
  exercise_id: string
  set_number: number
  weight_kg: number
  reps_completed: number
}

interface PersonalBest {
  exercise_name: string
  weight_kg: number
  reps: number
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

interface Finisher {
  id: string
  name: string
  category: string
  isEmom: boolean
  emomInterval: number | null
  isSuperset: boolean
  exercises: WorkoutExercise[]
}

interface WorkoutClientProps {
  workoutId: string
  exercises: WorkoutExercise[]
  oneRMs: { exercise_name: string; weight_kg: number }[]
  personalBests?: PersonalBest[]
  clientProgramId?: string
  scheduledDate?: string
  finishers?: Finisher[]
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
    case 'time': return `${value}s`
    case 'failure': return 'To Failure'
    default: return value
  }
}

export default function WorkoutClient({ workoutId, exercises, oneRMs, personalBests = [], clientProgramId, scheduledDate, finishers = [] }: WorkoutClientProps) {
  const [setLogs, setSetLogs] = useState<Map<string, SetLog>>(new Map())
  const [previousLogs, setPreviousLogs] = useState<Map<string, PreviousSetLog[]>>(new Map())
  const [saving, setSaving] = useState(false)
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null)
  const [swappedExercises, setSwappedExercises] = useState<Map<string, SwappedExercise>>(new Map())
  // EMOM round tracking: finisherId -> Set of completed round numbers
  const [emomRoundsCompleted, setEmomRoundsCompleted] = useState<Map<string, Set<number>>>(new Map())
  const supabase = createClient()

  // Toggle EMOM round completion
  const toggleEmomRound = (finisherId: string, roundNumber: number) => {
    setEmomRoundsCompleted(prev => {
      const newMap = new Map(prev)
      const rounds = new Set(newMap.get(finisherId) || [])
      if (rounds.has(roundNumber)) {
        rounds.delete(roundNumber)
      } else {
        rounds.add(roundNumber)
      }
      newMap.set(finisherId, rounds)
      return newMap
    })
  }

  // Get number of rounds for EMOM (from first exercise's sets count)
  const getEmomRounds = (finisher: Finisher): number => {
    if (finisher.exercises.length === 0) return 5
    return finisher.exercises[0]?.sets?.length || 5
  }

  // Format cardio target for display
  const formatCardioTarget = (set: any): string => {
    if (set.cardio_value && set.cardio_unit) {
      return `${set.cardio_value} ${set.cardio_unit}`
    }
    if (set.cardio_type === 'duration') {
      return `${set.cardio_value || '?'} ${set.cardio_unit || 'min'}`
    }
    return set.reps || '?'
  }

  // Load previous logs for each exercise
  useEffect(() => {
    loadPreviousLogs()
  }, [workoutId])

  const loadPreviousLogs = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    console.log('[loadPreviousLogs] Loading for workout:', workoutId)
    console.log('[loadPreviousLogs] Exercises:', exercises.map(e => ({ id: e.id, name: e.exercise_name })))

    // APPROACH 1: Try to find previous logs for THIS EXACT workout (most accurate)
    const { data: recentWorkoutLog, error: workoutLogError } = await supabase
      .from('workout_logs')
      .select('id, completed_at')
      .eq('client_id', user.id)
      .eq('workout_id', workoutId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    console.log('[loadPreviousLogs] Recent workout log:', recentWorkoutLog, 'Error:', workoutLogError?.message)

    if (recentWorkoutLog) {
      // Get set logs for this workout log - match by exercise_id (same workout structure)
      const { data: setLogs, error: setLogsError } = await supabase
        .from('set_logs')
        .select('exercise_id, set_number, weight_kg, reps_completed')
        .eq('workout_log_id', recentWorkoutLog.id)

      console.log('[loadPreviousLogs] Set logs found:', setLogs?.length || 0, 'Error:', setLogsError?.message)

      if (setLogs && setLogs.length > 0) {
        const logsByExercise = new Map<string, PreviousSetLog[]>()
        setLogs.forEach(log => {
          const existing = logsByExercise.get(log.exercise_id) || []
          existing.push({
            exercise_id: log.exercise_id,
            set_number: log.set_number,
            weight_kg: log.weight_kg,
            reps_completed: log.reps_completed
          })
          logsByExercise.set(log.exercise_id, existing)
        })
        console.log('[loadPreviousLogs] Mapped logs for exercises:', Array.from(logsByExercise.keys()))
        setPreviousLogs(logsByExercise)
        return
      }
    }

    // APPROACH 2: Fallback - find previous logs by exercise NAME (handles program restructuring)
    console.log('[loadPreviousLogs] Fallback: searching by exercise name')
    
    const exerciseNames = exercises.map(e => e.exercise_name.toLowerCase())
    
    // Get recent workout logs (last 60 days)
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    
    const { data: allWorkoutLogs } = await supabase
      .from('workout_logs')
      .select('id, completed_at')
      .eq('client_id', user.id)
      .gte('completed_at', sixtyDaysAgo.toISOString())
      .order('completed_at', { ascending: false })
    
    if (!allWorkoutLogs || allWorkoutLogs.length === 0) {
      console.log('[loadPreviousLogs] No workout logs found in last 60 days')
      return
    }

    // Get all set_logs for these workout logs
    const workoutLogIds = allWorkoutLogs.map(wl => wl.id)
    const { data: allSetLogs } = await supabase
      .from('set_logs')
      .select('exercise_id, set_number, weight_kg, reps_completed, workout_log_id')
      .in('workout_log_id', workoutLogIds)

    if (!allSetLogs || allSetLogs.length === 0) {
      console.log('[loadPreviousLogs] No set logs found')
      return
    }

    // Get exercise names for these exercise_ids
    const exerciseIds = [...new Set(allSetLogs.map(sl => sl.exercise_id))]
    const { data: exerciseData } = await supabase
      .from('workout_exercises')
      .select('id, exercise_name')
      .in('id', exerciseIds)

    const exerciseNameMap = new Map(exerciseData?.map(e => [e.id, e.exercise_name.toLowerCase()]) || [])
    const logDates = new Map(allWorkoutLogs.map(wl => [wl.id, wl.completed_at]))

    // Group by exercise name, keeping most recent for each set_number
    const mostRecentByName = new Map<string, Map<number, { log: PreviousSetLog; date: string }>>()
    
    allSetLogs.forEach(log => {
      const exerciseName = exerciseNameMap.get(log.exercise_id)
      if (!exerciseName || !exerciseNames.includes(exerciseName)) return
      
      const logDate = logDates.get(log.workout_log_id) || ''
      const setMap = mostRecentByName.get(exerciseName) || new Map()
      const existing = setMap.get(log.set_number)
      
      if (!existing || logDate > existing.date) {
        setMap.set(log.set_number, {
          log: {
            exercise_id: log.exercise_id,
            set_number: log.set_number,
            weight_kg: log.weight_kg,
            reps_completed: log.reps_completed
          },
          date: logDate
        })
      }
      mostRecentByName.set(exerciseName, setMap)
    })

    // Map back to current exercise IDs
    const logsByExercise = new Map<string, PreviousSetLog[]>()
    exercises.forEach(exercise => {
      const exerciseName = exercise.exercise_name.toLowerCase()
      const setMap = mostRecentByName.get(exerciseName)
      if (setMap) {
        const logs = Array.from(setMap.values()).map(item => ({
          ...item.log,
          exercise_id: exercise.id
        }))
        logsByExercise.set(exercise.id, logs)
      }
    })

    console.log('[loadPreviousLogs] Fallback found logs for:', Array.from(logsByExercise.keys()))
    setPreviousLogs(logsByExercise)
  }

  // Handle log updates from exercise cards
  const handleLogUpdate = useCallback((exerciseId: string, setNumber: number, weight: number | null, reps: number | null) => {
    console.log('📝 [handleLogUpdate] Logging set:', { exerciseId, setNumber, weight, reps })
    const key = `${exerciseId}-${setNumber}`
    setSetLogs(prev => {
      const updated = new Map(prev)
      updated.set(key, { exercise_id: exerciseId, set_number: setNumber, weight_kg: weight, reps_completed: reps })
      console.log('📝 [handleLogUpdate] Updated setLogs, total entries:', updated.size)
      return updated
    })
  }, [])

  // Handle exercise swap
  const handleExerciseSwap = useCallback((exerciseId: string, newExerciseName: string, isCustom: boolean) => {
    setSwappedExercises(prev => {
      const updated = new Map(prev)
      updated.set(exerciseId, { exerciseId, newName: newExerciseName, isCustom })
      return updated
    })
  }, [])

  // Auto-save with debounce using useEffect to avoid stale closure issues
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingLogsRef = useRef<Map<string, SetLog>>(new Map())
  const isSavingRef = useRef(false)
  const workoutLogIdRef = useRef<string | null>(null)
  const swappedExercisesRef = useRef<Map<string, SwappedExercise>>(new Map())
  
  // Keep refs in sync with state
  useEffect(() => {
    pendingLogsRef.current = new Map(setLogs)
  }, [setLogs])
  
  useEffect(() => {
    workoutLogIdRef.current = workoutLogId
  }, [workoutLogId])
  
  useEffect(() => {
    swappedExercisesRef.current = new Map(swappedExercises)
  }, [swappedExercises])

  // Trigger save whenever setLogs changes
  useEffect(() => {
    if (setLogs.size === 0) return
    
    console.log('💾 [Save Trigger] setLogs changed, scheduling save in 1.5s...', setLogs.size, 'entries')
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Set new debounced save
    saveTimeoutRef.current = setTimeout(() => {
      console.log('💾 [Save Trigger] Debounce complete, calling saveWorkoutLogs...')
      saveWorkoutLogs()
    }, 1500)
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [setLogs])
  
  // CRITICAL: Force save when leaving page (unmount or navigation)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingLogsRef.current.size > 0 && !isSavingRef.current) {
        // Try to save synchronously before page unloads
        saveWorkoutLogs()
        // Show browser warning
        e.preventDefault()
        e.returnValue = ''
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    // Cleanup: force save on unmount (navigation within app)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // Clear any pending debounce and save immediately
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      // Force immediate save if there's pending data
      if (pendingLogsRef.current.size > 0 && !isSavingRef.current) {
        saveWorkoutLogs()
      }
    }
  }, [])

  const saveWorkoutLogs = async () => {
    // Prevent concurrent saves
    if (isSavingRef.current) return
    
    const logsToProcess = pendingLogsRef.current
    if (logsToProcess.size === 0) return
    
    isSavingRef.current = true
    setSaving(true)
    
    console.log('[saveWorkoutLogs] Starting save for workout:', workoutId)
    console.log('[saveWorkoutLogs] Logs to save:', Array.from(logsToProcess.values()))
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('[saveWorkoutLogs] No user found!')
        return
      }
      console.log('[saveWorkoutLogs] User:', user.id)

      let logId = workoutLogIdRef.current

      // Create or get workout log
      if (!logId) {
        // Use upsert to handle race condition - find existing or create new
        const { data: existingLog, error: existingLogError } = await supabase
          .from('workout_logs')
          .select('id')
          .eq('client_id', user.id)
          .eq('workout_id', workoutId)
          .gte('completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Within last 24h
          .order('completed_at', { ascending: false })
          .limit(1)
          .single()

        console.log('[saveWorkoutLogs] Existing log check:', existingLog, 'Error:', existingLogError?.message)

        if (existingLog) {
          logId = existingLog.id
        } else {
          const insertData = {
            client_id: user.id,
            workout_id: workoutId,
            completed_at: new Date().toISOString(),
            scheduled_date: scheduledDate || new Date().toISOString().split('T')[0]
          }
          console.log('[saveWorkoutLogs] Creating new workout_log:', insertData)
          
          const { data: newLog, error: logError } = await supabase
            .from('workout_logs')
            .insert(insertData)
            .select('id')
            .single()

          console.log('[saveWorkoutLogs] Created workout_log:', newLog, 'Error:', logError?.message)
          
          if (logError) throw logError
          logId = newLog.id
        }
        
        setWorkoutLogId(logId)
        workoutLogIdRef.current = logId
      }

      // Build set logs for upsert
      const logsToSave = Array.from(logsToProcess.values())
        .filter(log => log.weight_kg !== null || log.reps_completed !== null)
        .map(log => {
          // Check if this exercise was swapped
          const swapped = swappedExercisesRef.current.get(log.exercise_id)
          return {
            user_id: user.id, // Required for RLS and queries
            workout_log_id: logId,
            exercise_id: log.exercise_id,
            set_number: log.set_number,
            weight_kg: log.weight_kg,
            reps_completed: log.reps_completed,
            swapped_exercise_name: swapped?.newName || null
          }
        })

      console.log('[saveWorkoutLogs] Saving set_logs:', logsToSave.length, 'entries')
      
      if (logsToSave.length > 0) {
        console.log('[saveWorkoutLogs] Set logs data:', logsToSave)
        
        // Use upsert instead of delete+insert for atomicity
        const { data: upsertResult, error: setError } = await supabase
          .from('set_logs')
          .upsert(logsToSave, {
            onConflict: 'workout_log_id,exercise_id,set_number',
            ignoreDuplicates: false
          })
          .select()

        console.log('[saveWorkoutLogs] Upsert result:', upsertResult, 'Error:', setError?.message)

        if (setError) {
          // Fallback to delete+insert if upsert fails (constraint might not exist yet)
          console.warn('[saveWorkoutLogs] Upsert failed, falling back to delete+insert:', setError)
          
          const { error: deleteError } = await supabase
            .from('set_logs')
            .delete()
            .eq('workout_log_id', logId)
          
          console.log('[saveWorkoutLogs] Delete result, Error:', deleteError?.message)
          
          const { data: insertResult, error: insertError } = await supabase
            .from('set_logs')
            .insert(logsToSave)
            .select()
          
          console.log('[saveWorkoutLogs] Insert result:', insertResult, 'Error:', insertError?.message)
          
          if (insertError) throw insertError
        }
        
        console.log('[saveWorkoutLogs] ✅ Save complete!')
      }
    } catch (err) {
      console.error('[saveWorkoutLogs] ❌ Failed to save workout logs:', err)
    } finally {
      isSavingRef.current = false
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
    
    // Find personal best for this exercise
    const pb = personalBests.find(p => 
      p.exercise_name.toLowerCase() === displayName.toLowerCase()
    )

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
        personalBest={pb ? { weight_kg: pb.weight_kg, reps: pb.reps } : null}
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
              <div className="px-3 py-2 border-b border-yellow-400/20">
                <span className="text-xs font-medium text-yellow-400 uppercase tracking-wide">
                  Superset
                </span>
              </div>
              
              {/* Superset Exercises */}
              <div className="divide-y divide-yellow-400/20">
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

      {/* Finishers */}
      {finishers.map((finisher) => {
        const finisherExerciseGroups = groupExercises(finisher.exercises)
        const categoryColors: Record<string, { border: string; bg: string; text: string; divider: string }> = {
          cardio: { border: 'border-orange-500/50', bg: 'bg-orange-500/5', text: 'text-orange-400', divider: 'divide-orange-500/20' },
          hyrox: { border: 'border-red-500/50', bg: 'bg-red-500/5', text: 'text-red-400', divider: 'divide-red-500/20' },
          strength: { border: 'border-blue-500/50', bg: 'bg-blue-500/5', text: 'text-blue-400', divider: 'divide-blue-500/20' },
          hybrid: { border: 'border-purple-500/50', bg: 'bg-purple-500/5', text: 'text-purple-400', divider: 'divide-purple-500/20' },
        }
        const colors = categoryColors[finisher.category] || categoryColors.strength
        
        return (
          <div 
            key={finisher.id}
            className={`relative border-2 ${colors.border} rounded-2xl overflow-hidden ${colors.bg} mt-6`}
          >
            {/* Finisher Header */}
            <div className={`px-4 py-3 border-b ${colors.border.replace('border-', 'border-').replace('/50', '/30')}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${colors.text} uppercase tracking-wider`}>
                    Finisher
                  </span>
                  <span className="text-zinc-500 text-xs">•</span>
                  <span className="text-zinc-400 text-sm font-medium">{finisher.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {finisher.isEmom && (
                    <span className={`px-2 py-0.5 ${colors.bg} ${colors.text} text-xs font-semibold rounded-full border ${colors.border}`}>
                      EMOM {finisher.emomInterval ? `${finisher.emomInterval >= 60 ? `${finisher.emomInterval / 60}min` : `${finisher.emomInterval}s`}` : ''}
                    </span>
                  )}
                  {finisher.isSuperset && (
                    <span className={`px-2 py-0.5 ${colors.bg} ${colors.text} text-xs font-semibold rounded-full border ${colors.border}`}>
                      Superset
                    </span>
                  )}
                </div>
              </div>
              
              {/* Hyrox Details - show if any exercise has hyrox data */}
              {finisher.category === 'hyrox' && finisher.exercises.some(ex => ex.sets.some(s => s.hyrox_station || s.hyrox_distance)) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {finisher.exercises.map(ex => {
                    const hyroxSet = ex.sets.find(s => s.hyrox_station || s.hyrox_distance)
                    if (!hyroxSet) return null
                    return (
                      <div key={ex.id} className="flex flex-wrap items-center gap-2 text-xs">
                        {hyroxSet.hyrox_station && (
                          <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded-lg font-medium">
                            {hyroxSet.hyrox_station}
                          </span>
                        )}
                        {hyroxSet.hyrox_distance && (
                          <span className="text-zinc-300">
                            {hyroxSet.hyrox_distance}{hyroxSet.hyrox_unit || 'm'}
                          </span>
                        )}
                        {hyroxSet.hyrox_target_time && (
                          <span className="text-yellow-400 font-medium">
                            Target: {hyroxSet.hyrox_target_time}
                          </span>
                        )}
                        {hyroxSet.hyrox_weight_class && (
                          <span className="px-2 py-1 bg-zinc-700 text-zinc-300 rounded-lg">
                            {hyroxSet.hyrox_weight_class}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            
            {/* Finisher Exercises - EMOM gets round-based view, others get normal sets */}
            {finisher.isEmom ? (
              /* EMOM Round-Based View */
              <div className="p-4">
                {/* Exercise List */}
                <div className="space-y-2 mb-4">
                  {finisher.exercises.map((exercise, idx) => {
                    const firstSet = exercise.sets[0]
                    return (
                      <div key={exercise.id} className="flex items-center gap-3 py-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${colors.bg} ${colors.text}`}>
                          {idx + 1}
                        </span>
                        <span className="text-white font-medium flex-1">{exercise.exercise_name}</span>
                        <span className="text-zinc-400 text-sm">
                          {firstSet?.cardio_value && firstSet?.cardio_unit 
                            ? `${firstSet.cardio_value} ${firstSet.cardio_unit}`
                            : firstSet?.reps || '?'}
                        </span>
                      </div>
                    )
                  })}
                </div>
                
                {/* Round Progress */}
                <div className="border-t border-zinc-700 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-zinc-400">Rounds</span>
                    <span className="text-sm text-zinc-500">
                      {emomRoundsCompleted.get(finisher.id)?.size || 0}/{getEmomRounds(finisher)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: getEmomRounds(finisher) }, (_, i) => i + 1).map(round => {
                      const completed = emomRoundsCompleted.get(finisher.id)?.has(round) || false
                      return (
                        <button
                          key={round}
                          onClick={() => toggleEmomRound(finisher.id, round)}
                          className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                            completed 
                              ? `${colors.bg} ${colors.text} border-2 ${colors.border}` 
                              : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:border-zinc-600'
                          }`}
                        >
                          {completed ? '✓' : round}
                        </button>
                      )
                    })}
                  </div>
                </div>
                
                {/* Mark All Complete */}
                {(emomRoundsCompleted.get(finisher.id)?.size || 0) === getEmomRounds(finisher) && (
                  <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
                    <span className="text-green-400 font-medium">✓ Finisher Complete!</span>
                  </div>
                )}
              </div>
            ) : (
              /* Normal Set-Based View for non-EMOM finishers */
              <div className={`${colors.divider} divide-y`}>
                {finisherExerciseGroups.map((group) => {
                  if (group.type === 'superset') {
                    return (
                      <div key={group.supersetGroup} className="p-2">
                        <div className="border border-yellow-400/30 rounded-xl overflow-hidden bg-yellow-400/5">
                          <div className="px-3 py-1.5 border-b border-yellow-400/20">
                            <span className="text-xs font-medium text-yellow-400 uppercase tracking-wide">
                              Superset
                            </span>
                          </div>
                          <div className="divide-y divide-yellow-400/20">
                            {group.exercises.map((exercise) => (
                              <div key={exercise.id} className="px-1 py-1">
                                {renderExerciseCard(exercise, exercises.length + finisher.exercises.indexOf(exercise), true)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  } else {
                    const exercise = group.exercises[0]
                    return (
                      <div key={exercise.id} className="p-2">
                        {renderExerciseCard(exercise, exercises.length + finisher.exercises.indexOf(exercise), false)}
                      </div>
                    )
                  }
                })}
              </div>
            )}
          </div>
        )
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

// Debounce is now handled via useEffect in WorkoutClient
