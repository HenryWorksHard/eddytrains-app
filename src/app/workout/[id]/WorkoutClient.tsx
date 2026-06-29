'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '../../lib/supabase/client'
import ExerciseCard from './ExerciseCard'
import SaveIndicator from '../../components/SaveIndicator'
import { formatDateToString } from '../../lib/dateUtils'

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
  exercise_uuid?: string  // Links to exercises table for cross-workout history
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
  // Per-set skip flag. Distinct from per-exercise skip
  // (workout_exercise_skips, whole exercise). On a per-set skip,
  // weight_kg + reps_completed stay null; is_skipped=true tells the
  // UI to render "Skipped" instead of "not yet logged".
  is_skipped?: boolean
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
  // Surface only on hard save failures — keeps the autosave loop silent
  // during normal happy-path saves. See SaveIndicator for rationale.
  const [saveError, setSaveError] = useState(false)
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null)
  const [swappedExercises, setSwappedExercises] = useState<Map<string, SwappedExercise>>(new Map())
  // Skips for THIS session — keyed by workout_exercises.id (= exercise.id
  // in this component). The card maintains its own optimistic copy after
  // the user confirms a skip; this map is just the initial seed loaded
  // alongside today's set_logs.
  const [skips, setSkips] = useState<Map<string, { reasonCategory: 'injury' | 'equipment' | 'time' | 'other' | null; reasonDetails: string | null }>>(new Map())
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

  // Load previous logs AND this session's saved data (if any).
  // Depends on both workoutId and scheduledDate so navigating between
  // dates for the same workout reloads the correct session.
  useEffect(() => {
    loadTodaySession()
    loadPreviousLogs()
  }, [workoutId, scheduledDate])

  // Load existing session for today (resume partial workout)
  const loadTodaySession = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check if there's an existing workout_log for today's scheduled workout
    const { data: todayLog } = await supabase
      .from('workout_logs')
      .select('id')
      .eq('client_id', user.id)
      .eq('workout_id', workoutId)
      .eq('scheduled_date', scheduledDate || formatDateToString(new Date()))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (todayLog) {
      console.log('[loadTodaySession] Found existing session for today:', todayLog.id)
      setWorkoutLogId(todayLog.id)
      workoutLogIdRef.current = todayLog.id

      // Load today's set_logs into setLogs state (these are CONFIRMED logs).
      // Also pull swapped_exercise_name + is_skipped so per-session swap
      // and per-set skip state survive a page reload.
      const { data: todaySets } = await supabase
        .from('set_logs')
        .select('exercise_id, set_number, weight_kg, reps_completed, swapped_exercise_name, is_skipped')
        .eq('workout_log_id', todayLog.id)

      if (todaySets && todaySets.length > 0) {
        console.log('[loadTodaySession] Restoring', todaySets.length, 'logged sets from today')
        const logMap = new Map<string, SetLog>()
        const swapMap = new Map<string, SwappedExercise>()
        todaySets.forEach(s => {
          const key = `${s.exercise_id}-${s.set_number}`
          logMap.set(key, {
            exercise_id: s.exercise_id,
            set_number: s.set_number,
            weight_kg: s.weight_kg,
            reps_completed: s.reps_completed,
            is_skipped: !!s.is_skipped,
          })
          if (s.swapped_exercise_name && !swapMap.has(s.exercise_id)) {
            // isCustom isn't stored on set_logs — default to false; only the
            // display name matters for restore. Fresh swaps still take the
            // happy path through SwapExerciseModal.
            swapMap.set(s.exercise_id, { exerciseId: s.exercise_id, newName: s.swapped_exercise_name, isCustom: false })
          }
        })
        setSetLogs(logMap)
        pendingLogsRef.current = logMap
        if (swapMap.size > 0) {
          setSwappedExercises(swapMap)
        }
      }

      // Also load any skipped exercises for this session so the cards
      // render in the skipped state on revisit.
      const { data: skipRows } = await supabase
        .from('workout_exercise_skips')
        .select('workout_exercise_id, reason_category, reason_details')
        .eq('workout_log_id', todayLog.id)

      if (skipRows && skipRows.length > 0) {
        const m = new Map<string, { reasonCategory: 'injury' | 'equipment' | 'time' | 'other' | null; reasonDetails: string | null }>()
        skipRows.forEach((r) => {
          m.set(r.workout_exercise_id, {
            reasonCategory: (r.reason_category as 'injury' | 'equipment' | 'time' | 'other' | null) ?? null,
            reasonDetails: r.reason_details ?? null,
          })
        })
        setSkips(m)
      }

      // Load per-session swaps. This is the authoritative source — written
      // immediately when the user picks a swap, even if they leave without
      // logging any sets. The set_logs fallback above only covers sessions
      // where at least one set was saved after the swap.
      const { data: swapRows } = await supabase
        .from('workout_exercise_swaps')
        .select('workout_exercise_id, substituted_exercise_name, is_custom')
        .eq('workout_log_id', todayLog.id)

      if (swapRows && swapRows.length > 0) {
        setSwappedExercises((prev) => {
          const m = new Map(prev)
          swapRows.forEach((r) => {
            m.set(r.workout_exercise_id, {
              exerciseId: r.workout_exercise_id,
              newName: r.substituted_exercise_name,
              isCustom: !!r.is_custom,
            })
          })
          return m
        })
      }
    }
  }

  const loadPreviousLogs = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    console.log('[loadPreviousLogs] Loading for workout:', workoutId)

    // Get the scheduled date to EXCLUDE from previous logs
    const viewingDateStr = scheduledDate || formatDateToString(new Date())
    const viewingDateStart = new Date(viewingDateStr + 'T00:00:00')

    // Swap-aware: load recent set_logs joined to workout_exercises, group
    // by the EFFECTIVE exercise name (swapped_exercise_name if present,
    // else the original program slot's exercise_name). After a swap, the
    // card looks up by the currently-displayed name, so the "Last week"
    // hint reflects the swapped exercise's history — not the original.
    const logsByExerciseName = new Map<string, PreviousSetLog[]>()

    const { data: prevSetLogs, error } = await supabase
      .from('set_logs')
      .select(`
        set_number,
        weight_kg,
        reps_completed,
        created_at,
        swapped_exercise_name,
        workout_exercises!inner(exercise_name)
      `)
      .eq('user_id', user.id)
      .lt('created_at', viewingDateStart.toISOString())
      .not('weight_kg', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) {
      console.error('[loadPreviousLogs] Query error:', error.message)
      setPreviousLogs(logsByExerciseName)
      return
    }

    console.log('[loadPreviousLogs] Found', prevSetLogs?.length || 0, 'previous logs')

    if (prevSetLogs && prevSetLogs.length > 0) {
      // For each unique effective name, keep the MOST RECENT set per
      // set_number (rows ordered desc by created_at, so first wins).
      const mostRecentByName = new Map<string, Map<number, PreviousSetLog>>()

      for (const log of prevSetLogs as unknown as Array<{
        set_number: number
        weight_kg: number
        reps_completed: number
        swapped_exercise_name: string | null
        workout_exercises: { exercise_name: string | null } | null
      }>) {
        const effective = (log.swapped_exercise_name ||
          log.workout_exercises?.exercise_name ||
          '').trim().toLowerCase()
        if (!effective) continue

        const setMap = mostRecentByName.get(effective) || new Map<number, PreviousSetLog>()
        if (!setMap.has(log.set_number)) {
          setMap.set(log.set_number, {
            exercise_id: '',
            set_number: log.set_number,
            weight_kg: log.weight_kg,
            reps_completed: log.reps_completed,
          })
        }
        mostRecentByName.set(effective, setMap)
      }

      mostRecentByName.forEach((setMap, name) => {
        const sets = Array.from(setMap.values()).sort((a, b) => a.set_number - b.set_number)
        logsByExerciseName.set(name, sets)
      })
    }

    console.log('[loadPreviousLogs] Loaded previous logs for', logsByExerciseName.size, 'exercise names')
    setPreviousLogs(logsByExerciseName)
  }

  // Handle log updates from exercise cards
  const handleLogUpdate = useCallback((exerciseId: string, setNumber: number, weight: number | null, reps: number | null) => {
    console.log('📝 [handleLogUpdate] Logging set:', { exerciseId, setNumber, weight, reps })
    const key = `${exerciseId}-${setNumber}`
    setSetLogs(prev => {
      const updated = new Map(prev)
      const existing = prev.get(key)
      // Logging a value clears the skip — they're mutually exclusive.
      updated.set(key, {
        exercise_id: exerciseId,
        set_number: setNumber,
        weight_kg: weight,
        reps_completed: reps,
        is_skipped: false,
        swapped_exercise_name: existing?.swapped_exercise_name ?? null,
      })
      console.log('📝 [handleLogUpdate] Updated setLogs, total entries:', updated.size)
      return updated
    })
  }, [])

  // Per-set skip toggle. weight/reps cleared when skipping. Autosave
  // picks this up because setLogs changed.
  const handleSetSkipToggle = useCallback((exerciseId: string, setNumber: number, skipped: boolean) => {
    const key = `${exerciseId}-${setNumber}`
    setSetLogs(prev => {
      const updated = new Map(prev)
      const existing = prev.get(key)
      updated.set(key, {
        exercise_id: exerciseId,
        set_number: setNumber,
        weight_kg: skipped ? null : (existing?.weight_kg ?? null),
        reps_completed: skipped ? null : (existing?.reps_completed ?? null),
        is_skipped: skipped,
        swapped_exercise_name: existing?.swapped_exercise_name ?? null,
      })
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

  // Save IMMEDIATELY on each set change (no debounce - critical for phone lock/background)
  // Use a short delay just to batch rapid changes (e.g., user adjusting weight picker)
  useEffect(() => {
    if (setLogs.size === 0) return
    
    console.log('💾 [Save Trigger] setLogs changed, saving in 500ms...', setLogs.size, 'entries')
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Short delay to batch rapid wheel picker changes, but save quickly
    saveTimeoutRef.current = setTimeout(() => {
      console.log('💾 [Save Trigger] Saving now...')
      saveWorkoutLogs()
    }, 500)
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [setLogs])
  
  // CRITICAL: Save when page visibility changes (phone lock, app background, tab switch)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && pendingLogsRef.current.size > 0) {
        console.log('💾 [Visibility] Page hidden, forcing save...')
        // Clear debounce and save immediately
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
        }
        saveWorkoutLogs()
      }
    }
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingLogsRef.current.size > 0 && !isSavingRef.current) {
        saveWorkoutLogs()
        e.preventDefault()
        e.returnValue = ''
      }
    }
    
    // Handle "Update Workout" button click from CompleteWorkoutButton
    const handleForceSave = () => {
      console.log('💾 [ForceSave] Update Workout clicked, saving...')
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveWorkoutLogs()
    }

    // Awaitable force-save. CompleteWorkoutButton calls this before
    // POSTing /api/workouts/complete so the last debounced set never
    // races the completion (Halley bug, 2026-06-29).
    // Strategy: clear pending debounce → wait for any in-flight save
    // to settle → save the latest pending snapshot. Capped at timeoutMs
    // so a stuck save never blocks the complete flow indefinitely.
    const flushPendingSaves = async (timeoutMs = 3000): Promise<void> => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      const start = Date.now()
      while (isSavingRef.current && Date.now() - start < timeoutMs) {
        await new Promise((r) => setTimeout(r, 50))
      }
      if (pendingLogsRef.current.size > 0) {
        await saveWorkoutLogs()
      }
    }
    ;(window as unknown as { __cmpdFlushWorkoutSaves?: () => Promise<void> }).__cmpdFlushWorkoutSaves = flushPendingSaves

    // Handle phone lock, app switch, tab switch
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('forceSaveWorkout', handleForceSave)
    // iOS-specific: pagehide fires more reliably than beforeunload
    window.addEventListener('pagehide', () => {
      if (pendingLogsRef.current.size > 0) {
        saveWorkoutLogs()
      }
    })

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('forceSaveWorkout', handleForceSave)
      delete (window as unknown as { __cmpdFlushWorkoutSaves?: () => Promise<void> }).__cmpdFlushWorkoutSaves
      // Force save on unmount
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
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
    setSaveError(false)

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

      // Create or get workout log.
      // CRITICAL: this lookup MUST use the same key as loadTodaySession
      // — (client_id, workout_id, scheduled_date) — or we end up with
      // sets scattered across two workout_log rows. The previous lookup
      // used `completed_at >= now-24h` which mismatched on workouts the
      // user came back to finish >24h later (Halley bug, 2026-06-29).
      // The DB-side UNIQUE constraint added in the same PR is the
      // belt-and-braces.
      if (!logId) {
        const effectiveScheduledDate = scheduledDate || formatDateToString(new Date())

        const { data: existingLog, error: existingLogError } = await supabase
          .from('workout_logs')
          .select('id')
          .eq('client_id', user.id)
          .eq('workout_id', workoutId)
          .eq('scheduled_date', effectiveScheduledDate)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        console.log('[saveWorkoutLogs] Existing log check:', existingLog, 'Error:', existingLogError?.message)

        if (existingLog) {
          logId = existingLog.id
        } else {
          const insertData = {
            client_id: user.id,
            workout_id: workoutId,
            completed_at: new Date().toISOString(),
            scheduled_date: effectiveScheduledDate
          }
          console.log('[saveWorkoutLogs] Creating new workout_log:', insertData)

          const { data: newLog, error: logError } = await supabase
            .from('workout_logs')
            .insert(insertData)
            .select('id')
            .single()

          console.log('[saveWorkoutLogs] Created workout_log:', newLog, 'Error:', logError?.message)

          if (logError) {
            // If the unique index trips, the row was just created by a
            // concurrent save — re-query and use the winner.
            const { data: raceWinner } = await supabase
              .from('workout_logs')
              .select('id')
              .eq('client_id', user.id)
              .eq('workout_id', workoutId)
              .eq('scheduled_date', effectiveScheduledDate)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (!raceWinner) throw logError
            logId = raceWinner.id
          } else {
            logId = newLog.id
          }
        }

        setWorkoutLogId(logId)
        workoutLogIdRef.current = logId
      }

      // Build set logs for upsert. Include rows that are either logged
      // (have weight/reps) OR deliberately skipped (is_skipped=true);
      // skip purely-empty rows so we don't insert blanks.
      const logsToSave = Array.from(logsToProcess.values())
        .filter(log => log.weight_kg !== null || log.reps_completed !== null || log.is_skipped === true)
        .map(log => {
          // Check if this exercise was swapped
          const swapped = swappedExercisesRef.current.get(log.exercise_id)
          // Get exercise_uuid for cross-workout history lookup
          const exercise = exercises.find(e => e.id === log.exercise_id)
          return {
            workout_log_id: logId,
            exercise_id: log.exercise_id,
            exercise_uuid: exercise?.exercise_uuid || null,
            user_id: user.id,  // For access control and queries
            set_number: log.set_number,
            weight_kg: log.weight_kg,
            reps_completed: log.reps_completed,
            swapped_exercise_name: swapped?.newName || null,
            is_skipped: log.is_skipped === true,
          }
        })

      console.log('[saveWorkoutLogs] Saving set_logs:', logsToSave.length, 'entries')
      
      if (logsToSave.length > 0) {
        console.log('[saveWorkoutLogs] Set logs data:', logsToSave)

        // Upsert against the unique constraint (workout_log_id, exercise_id,
        // set_number) added in migration 20260225. The previous code had a
        // delete+insert fallback for "constraint might not exist yet" — that
        // fallback was a data-loss footgun: if the delete succeeded but the
        // insert failed (network drop, 5xx, JWT expiry mid-call), every
        // saved set for the workout was gone. Removed 2026-06-29 as part
        // of the Halley fix. The upsert is the only path now; on error we
        // surface to the user via saveError so they can retry.
        const { data: upsertResult, error: setError } = await supabase
          .from('set_logs')
          .upsert(logsToSave, {
            onConflict: 'workout_log_id,exercise_id,set_number',
            ignoreDuplicates: false
          })
          .select()

        console.log('[saveWorkoutLogs] Upsert result:', upsertResult, 'Error:', setError?.message)

        if (setError) throw setError

        console.log('[saveWorkoutLogs] ✅ Save complete!')
      }
    } catch (err) {
      console.error('[saveWorkoutLogs] ❌ Failed to save workout logs:', err)
      setSaveError(true)
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

  // Extract per-exercise logs from the session-level setLogs map so we
  // can pass them down to ExerciseCard as existingLogs.
  const getExistingLogsForExercise = (exerciseId: string) => {
    const logs: { set_number: number; weight_kg: number | null; reps_completed: number | null; is_skipped?: boolean }[] = []
    setLogs.forEach((log, key) => {
      if (key.startsWith(`${exerciseId}-`)) {
        logs.push({
          set_number: log.set_number,
          weight_kg: log.weight_kg,
          reps_completed: log.reps_completed,
          is_skipped: log.is_skipped === true,
        })
      }
    })
    return logs.length > 0 ? logs : undefined
  }

  const renderExerciseCard = (exercise: WorkoutExercise, idx: number, isInSuperset: boolean = false) => {
    const displayName = getExerciseDisplayName(exercise)
    const oneRM = find1RM(displayName, oneRMs)
    const intensityType = exercise.sets[0]?.intensity_type || 'rir'
    const intensityValue = exercise.sets[0]?.intensity_value || '2'
    const calculatedWeight = calculateWeight(intensityType, intensityValue, oneRM)
    // Look up previous logs by EFFECTIVE exercise name so a swapped slot
    // shows the swapped exercise's last-week data, not the original's.
    // previousLogs is keyed by lowercased name (see loadPreviousLogs).
    const prevLogs = previousLogs.get(displayName.trim().toLowerCase()) || []
    const swap = swappedExercises.get(exercise.id)

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
        existingLogs={getExistingLogsForExercise(exercise.id)}
        personalBest={pb ? { weight_kg: pb.weight_kg, reps: pb.reps } : null}
        onLogUpdate={handleLogUpdate}
        onSetSkipToggle={handleSetSkipToggle}
        onExerciseSwap={handleExerciseSwap}
        workoutExerciseId={exercise.id}
        workoutId={workoutId}
        scheduledDate={scheduledDate || formatDateToString(new Date())}
        existingSwap={swap ? { newName: swap.newName, isCustom: swap.isCustom } : null}
        existingSkip={skips.get(exercise.id) ?? null}
        onSkipChange={(exId, next) => {
          setSkips((prev) => {
            const m = new Map(prev)
            if (next === null) m.delete(exId)
            else m.set(exId, next)
            return m
          })
        }}
      />
    )
  }

  return (
    <div className="space-y-3 relative">
      {/* Floating auto-save indicator */}
      <div className="sticky top-2 z-20 flex justify-end pointer-events-none">
        <SaveIndicator saving={saving} error={saveError} />
      </div>

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
      
      {/* Auto-save indicator: silent on happy path. Errors surface via the
          sticky SaveIndicator at the top of the workout list. */}
    </div>
  )
}

// Debounce is now handled via useEffect in WorkoutClient
