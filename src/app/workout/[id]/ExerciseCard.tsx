'use client'

import { memo, useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, X, Check, Trophy, Search, ArrowLeftRight, History, Loader2, Ban, RotateCcw } from 'lucide-react'
import TutorialModal from './TutorialModal'
import { createClient } from '../../lib/supabase/client'
import WheelPicker from '../../components/WheelPicker'
import PRCelebration from '../../components/PRCelebration'

interface ExerciseSet {
  set_number: number
  reps: string
  intensity_type: string
  intensity_value: string
  rest_bracket?: string
  weight_type?: string
  notes?: string
  // Cardio fields
  cardio_type?: string
  cardio_value?: string
  cardio_unit?: string
  heart_rate_zone?: string
}

interface SetLog {
  set_number: number
  weight_kg: number | null
  reps_completed: number | null
  steps_completed?: number | null
  // Per-set skip: distinct from the per-exercise Skip button in the
  // card header (which marks the whole exercise opted-out).
  is_skipped?: boolean
}

interface Exercise {
  id: string
  name: string
  muscle_group: string
}

interface PersonalBest {
  weight_kg: number
  reps: number
}

type SkipReasonCategory = 'injury' | 'equipment' | 'time' | 'other'

interface SkipState {
  reasonCategory: SkipReasonCategory | null
  reasonDetails: string | null
}

interface ExerciseCardProps {
  exerciseId: string
  exerciseName: string
  index: number
  sets: ExerciseSet[]
  notes?: string
  supersetGroup?: string
  tutorialUrl?: string
  tutorialSteps?: string[]
  intensitySummary: string
  calculatedWeight?: number | null
  previousLogs?: SetLog[]
  existingLogs?: SetLog[]  // Saved logs from THIS session (e.g. resuming a completed workout)
  personalBest?: PersonalBest | null
  onLogUpdate: (exerciseId: string, setNumber: number, weight: number | null, reps: number | null) => void
  onSetSkipToggle?: (exerciseId: string, setNumber: number, skipped: boolean) => void
  onExerciseSwap?: (exerciseId: string, newExerciseName: string, isCustom: boolean) => void
  workoutExerciseId?: string
  // Skip plumbing — passed down from WorkoutClient so the per-exercise
  // skip API calls have enough context to find or create the workout_log.
  workoutId?: string
  scheduledDate?: string
  existingSkip?: SkipState | null
  onSkipChange?: (exerciseId: string, skip: SkipState | null) => void
  // Restored swap from a previous session — if set, the card mounts in
  // the swapped state (title shows the new name, "Swapped" badge appears).
  // Keeps the UI consistent with set_logs.swapped_exercise_name after a
  // page reload.
  existingSwap?: { newName: string; isCustom: boolean } | null
}

// Exercise Swap Modal Component
function SwapExerciseModal({
  exerciseName,
  muscleGroup,
  onSelect,
  onClose,
  clientId
}: {
  exerciseName: string
  muscleGroup: string
  onSelect: (name: string, isCustom: boolean, customExerciseId?: string) => void
  onClose: () => void
  clientId: string
}) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [customExercises, setCustomExercises] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customName, setCustomName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const supabase = createClient()
  
  useEffect(() => {
    loadExercises()
  }, [muscleGroup])
  
  const loadExercises = async () => {
    setLoading(true)
    
    // Load exercises with same muscle group
    const { data: standardExercises } = await supabase
      .from('exercises')
      .select('id, name, muscle_group')
      .eq('muscle_group', muscleGroup)
      .neq('name', exerciseName)
      .order('name')
    
    // Load client's custom exercises
    const { data: clientCustom } = await supabase
      .from('client_custom_exercises')
      .select('id, name')
      .eq('client_id', clientId)
      .order('name')
    
    setExercises(standardExercises || [])
    setCustomExercises(clientCustom || [])
    setLoading(false)
  }
  
  const handleSaveCustom = async () => {
    if (!customName.trim()) return
    
    // Save to client_custom_exercises
    const { data, error } = await supabase
      .from('client_custom_exercises')
      .insert({
        client_id: clientId,
        name: customName.trim(),
        category: muscleGroup
      })
      .select('id')
      .single()
    
    if (!error) {
      onSelect(customName.trim(), true, data?.id)
    }
  }
  
  // Filter exercises by search query
  const filteredExercises = exercises.filter(ex => 
    ex.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredCustom = customExercises.filter(ex => 
    ex.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border-t border-zinc-700 rounded-t-3xl w-full max-w-md min-h-[65dvh] max-h-[calc(100dvh-env(safe-area-inset-top)-1rem)] overflow-hidden pb-[env(safe-area-inset-bottom)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 bg-zinc-700 rounded-full" />
        </div>
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">Swap Exercise</h3>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Search Input */}
          {!showCustomInput && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search exercises..."
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : showCustomInput ? (
            <div className="space-y-4">
              <button
                onClick={() => setShowCustomInput(false)}
                className="text-yellow-400 text-sm font-medium"
              >
                ← Back to list
              </button>
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Custom Exercise Name</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Enter exercise name..."
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  autoFocus
                />
              </div>
              <button
                onClick={handleSaveCustom}
                disabled={!customName.trim()}
                className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-semibold rounded-xl transition-colors"
              >
                Use This Exercise
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Client's custom exercises first */}
              {filteredCustom.length > 0 && (
                <>
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 px-1">
                    Your Custom Exercises
                  </div>
                  {filteredCustom.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => onSelect(ex.name, true, ex.id)}
                      className="w-full text-left px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl text-white transition-colors flex items-center gap-2"
                    >
                      <span className="text-yellow-400">★</span>
                      {ex.name}
                    </button>
                  ))}
                </>
              )}
              
              {/* Standard exercises */}
              {filteredCustom.length > 0 && filteredExercises.length > 0 && (
                <div className="text-xs text-zinc-500 uppercase tracking-wider mt-4 mb-2 px-1">
                  {muscleGroup} Exercises
                </div>
              )}
              {filteredExercises.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => onSelect(ex.name, false)}
                  className="w-full text-left px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl text-white transition-colors"
                >
                  {ex.name}
                </button>
              ))}
              
              {/* Other option */}
              <button
                onClick={() => setShowCustomInput(true)}
                className="w-full text-left px-4 py-3 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 rounded-xl text-yellow-400 transition-colors mt-4"
              >
                + Add Custom Exercise
              </button>
              
              {filteredExercises.length === 0 && filteredCustom.length === 0 && searchQuery && (
                <p className="text-zinc-500 text-center py-4">
                  No exercises found for "{searchQuery}"
                </p>
              )}
              
              {exercises.length === 0 && customExercises.length === 0 && !searchQuery && (
                <p className="text-zinc-500 text-center py-4">
                  No alternative exercises found for this muscle group.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Skip Exercise Modal — bottom sheet with reason chips + optional details.
// Mirrors the swap modal styling.
function SkipExerciseModal({
  exerciseName,
  initial,
  submitting,
  onConfirm,
  onClose,
}: {
  exerciseName: string
  initial: SkipState | null
  submitting: boolean
  onConfirm: (skip: SkipState) => void
  onClose: () => void
}) {
  const [category, setCategory] = useState<SkipReasonCategory | null>(initial?.reasonCategory ?? null)
  const [details, setDetails] = useState(initial?.reasonDetails ?? '')

  const chips: { value: SkipReasonCategory; label: string }[] = [
    { value: 'injury', label: 'Injury' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'time', label: 'Short on time' },
    { value: 'other', label: 'Other' },
  ]

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border-t border-zinc-700 rounded-t-3xl w-full max-w-md min-h-[65dvh] max-h-[calc(100dvh-env(safe-area-inset-top)-1rem)] overflow-hidden pb-[env(safe-area-inset-bottom)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 bg-zinc-700 rounded-full" />
        </div>
        <div className="p-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-semibold text-white">Skip exercise</h3>
            <button onClick={onClose} className="p-2 -mr-1 text-zinc-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-zinc-400 truncate">
            <span className="text-white">{exerciseName}</span>
          </p>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Reason (optional)</label>
            <div className="flex flex-wrap gap-2">
              {chips.map((c) => {
                const selected = category === c.value
                return (
                  <button
                    key={c.value}
                    onClick={() => setCategory(selected ? null : c.value)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      selected
                        ? 'bg-yellow-400 text-black'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Details (optional)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 500))}
              placeholder="What happened? (visible to your coach)"
              rows={3}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
            />
            <p className="text-[11px] text-zinc-600 mt-1">{details.length}/500</p>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800 flex gap-2 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ reasonCategory: category, reasonDetails: details.trim() || null })}
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black font-bold rounded-xl transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
            Skip exercise
          </button>
        </div>
      </div>
    </div>
  )
}

function ExerciseCardInner({
  exerciseId,
  exerciseName,
  index,
  sets,
  notes,
  supersetGroup,
  tutorialUrl,
  tutorialSteps,
  intensitySummary,
  calculatedWeight,
  previousLogs = [],
  existingLogs,
  personalBest,
  onLogUpdate,
  onSetSkipToggle,
  onExerciseSwap,
  workoutExerciseId,
  workoutId,
  scheduledDate,
  existingSkip,
  onSkipChange,
  existingSwap,
}: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [skip, setSkip] = useState<SkipState | null>(existingSkip ?? null)
  const [showSkipModal, setShowSkipModal] = useState(false)
  const [skipSubmitting, setSkipSubmitting] = useState(false)

  // Seed localLogs from existingLogs (saved data for this session) on
  // first mount. This lets "View Workout" on a completed day show the
  // weights the client already logged, while still allowing edits.
  const [localLogs, setLocalLogs] = useState<Map<number, SetLog>>(() => {
    if (existingLogs && existingLogs.length > 0) {
      const m = new Map<number, SetLog>()
      existingLogs.forEach(l => m.set(l.set_number, l))
      return m
    }
    return new Map()
  })
  const [showSwapModal, setShowSwapModal] = useState(false)
  // Seed from existingSwap (restored from set_logs.swapped_exercise_name)
  // so a swap survives across page reloads. Falls back to the program's
  // exercise_name for unswapped sessions.
  const [currentExerciseName, setCurrentExerciseName] = useState(existingSwap?.newName || exerciseName)
  // Exercise history drawer state
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historySessions, setHistorySessions] = useState<
    { workoutLogId: string; date: string | null; sets: { setNumber: number; weight: number; reps: number }[] }[]
  >([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const [muscleGroup, setMuscleGroup] = useState<string>('other')
  const [wheelPicker, setWheelPicker] = useState<{ 
    open: boolean; 
    setNumber: number; 
    targetReps: string;
    restBracket?: string;
    mode: 'weight-reps' | 'steps';
  }>({ open: false, setNumber: 0, targetReps: '', mode: 'weight-reps' })
  const [prCelebration, setPRCelebration] = useState<{
    show: boolean
    weight: number
    reps: number
  }>({ show: false, weight: 0, reps: 0 })
  const [sessionBest, setSessionBest] = useState<{ weight: number; reps: number } | null>(null)
  const supabase = createClient()

  // Get client ID and muscle group on mount
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setClientId(user.id)
      
      // Get muscle group for this exercise
      const { data: exerciseData } = await supabase
        .from('exercises')
        .select('muscle_group')
        .eq('name', exerciseName)
        .single()
      
      if (exerciseData?.muscle_group) {
        setMuscleGroup(exerciseData.muscle_group)
      }
    }
    init()
  }, [exerciseName])

  // When existingLogs arrives asynchronously (loadTodaySession is async),
  // seed localLogs once. The seededRef ensures we never overwrite user
  // edits — once we've seeded (or the user types), we stop.
  const seededRef = useRef(false)
  useEffect(() => {
    if (existingLogs && existingLogs.length > 0 && !seededRef.current) {
      seededRef.current = true
      const m = new Map<number, SetLog>()
      existingLogs.forEach(l => m.set(l.set_number, l))
      setLocalLogs(m)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingLogs])

  // Sync `skip` from the existingSkip prop. useState only takes the
  // initial value on first mount — when WorkoutClient loads skips async
  // after mount, the prop updates but local state stayed null, so the
  // card never rendered as Skipped on revisit. Always-sync is safe here
  // because the user's skip/undo actions immediately call onSkipChange,
  // which round-trips through parent state and back into the prop.
  useEffect(() => {
    setSkip(existingSkip ?? null)
  }, [existingSkip?.reasonCategory, existingSkip?.reasonDetails])

  // Same fix for swap: the swap restore from workout_exercise_swaps is
  // async; without this, a swap done in a previous visit wouldn't show
  // when the user reopens the workout.
  useEffect(() => {
    setCurrentExerciseName(existingSwap?.newName || exerciseName)
  }, [existingSwap?.newName, exerciseName])

  // NOTE: We intentionally do NOT copy previousLogs into localLogs
  // previousLogs is historical data (last session) - for "Last: Xkg" display only
  // localLogs should only contain data entered in THIS session
  // This prevents old workout data from showing as "logged" when viewing future dates

  const handleWeightChange = (setNumber: number, value: string) => {
    // Allow empty, numbers, and decimal point
    if (value !== '' && !/^[0-9]*\.?[0-9]*$/.test(value)) return
    
    const weight = value === '' ? null : parseFloat(value)
    const weightToStore = value === '' ? null : (isNaN(weight!) ? null : weight)
    
    setLocalLogs(prev => {
      const current = prev.get(setNumber) || { set_number: setNumber, weight_kg: null, reps_completed: null }
      const updated = { ...current, weight_kg: weightToStore }
      const newMap = new Map(prev)
      newMap.set(setNumber, updated)
      onLogUpdate(exerciseId, setNumber, weightToStore, current.reps_completed)
      return newMap
    })
  }

  const handleRepsChange = (setNumber: number, value: string, restBracket?: string) => {
    // Allow empty and numbers only
    if (value !== '' && !/^[0-9]*$/.test(value)) return
    
    const reps = value === '' ? null : parseInt(value)
    const repsToStore = value === '' ? null : (isNaN(reps!) ? null : reps)
    
    setLocalLogs(prev => {
      const current = prev.get(setNumber) || { set_number: setNumber, weight_kg: null, reps_completed: null }
      const updated = { ...current, reps_completed: repsToStore }
      const newMap = new Map(prev)
      newMap.set(setNumber, updated)
      onLogUpdate(exerciseId, setNumber, current.weight_kg, repsToStore)
      return newMap
    })
  }

  // Check if this is a new PR (compare estimated 1RM using Epley formula)
  const isNewPR = (weight: number, reps: number): boolean => {
    if (!weight || !reps) return false
    
    // Calculate estimated 1RM for this set
    const estimated1RM = weight * (1 + reps / 30)
    
    // Compare to personal best (if exists)
    if (personalBest) {
      const bestEstimated1RM = personalBest.weight_kg * (1 + personalBest.reps / 30)
      if (estimated1RM > bestEstimated1RM) return true
    }
    
    // Compare to session best
    if (sessionBest) {
      const sessionEstimated1RM = sessionBest.weight * (1 + sessionBest.reps / 30)
      if (estimated1RM > sessionEstimated1RM) return true
    } else if (!personalBest) {
      // No previous data, any logged set with weight is a PR
      return weight > 0 && reps > 0
    }
    
    return false
  }

  // Handle wheel picker confirmation
  const handleWheelPickerConfirm = (weight: number | null, reps: number | null, steps?: number | null) => {
    const setNumber = wheelPicker.setNumber
    if (!setNumber) return // Safety check
    
    // Create updated log
    const current = localLogs.get(setNumber) || { set_number: setNumber, weight_kg: null, reps_completed: null, steps_completed: null }
    const updated = (steps !== undefined && steps !== null)
      ? { ...current, steps_completed: steps }
      : { ...current, weight_kg: weight, reps_completed: reps }
    
    // Update local state for THIS set only — no cascade. Subsequent sets
    // stay empty until the user opens them. When they do, the picker
    // defaults to the most recently logged set's values via
    // getPreviousSetValues, so they get a one-tap confirm if they're
    // grinding the same weight, or can change it for drop/pyramid sets.
    const newMap = new Map(localLogs)
    newMap.set(setNumber, updated)
    setLocalLogs(newMap)

    onLogUpdate(exerciseId, setNumber, weight, reps)
    
    // PR celebration disabled for now (glitchy)
    // TODO: Re-enable when fixed
    // if (weight && reps && personalBest && isNewPR(weight, reps)) {
    //   setPRCelebration({ show: true, weight, reps })
    //   setSessionBest({ weight, reps })
    // } else
    if (weight && reps) {
      // Update session best if better
      const estimated1RM = weight * (1 + reps / 30)
      if (!sessionBest || estimated1RM > sessionBest.weight * (1 + sessionBest.reps / 30)) {
        setSessionBest({ weight, reps })
      }
    }
    
    setWheelPicker({ open: false, setNumber: 0, targetReps: '', mode: 'weight-reps' })
  }

  // Check if exercise is steps-based
  // Only "Steps" exercise uses steps-only mode (not walking/running)
  const isStepsExercise = currentExerciseName.toLowerCase() === 'steps'
  
  // Check if exercise is cardio-based (duration/distance, no weight tracking)
  // Cardio exercises: have cardio_type set OR are bodyweight cardio activities
  const isCardioExercise = (() => {
    // Check if any set has cardio_type
    const hasCardioType = sets.some(s => s.cardio_type && s.cardio_type !== '')
    if (hasCardioType) return true
    
    // Check if bodyweight cardio exercise (running, cycling, rowing, etc.)
    const cardioKeywords = ['running', 'run', 'cycling', 'bike', 'rowing', 'row machine', 'treadmill', 'elliptical', 'walking', 'swim', 'cardio']
    const nameLower = currentExerciseName.toLowerCase()
    const isCardioName = cardioKeywords.some(k => nameLower.includes(k))
    const isBodyweight = sets.some(s => s.weight_type === 'bodyweight')
    
    return isCardioName && isBodyweight
  })()

  // Get previous set's logged values to pre-fill next set
  const getPreviousSetValues = (setNumber: number) => {
    if (!setNumber) return null
    
    // Try current set first (if re-editing)
    const currentLog = localLogs.get(setNumber)
    if (currentLog && (currentLog.weight_kg !== null || currentLog.reps_completed !== null || currentLog.steps_completed !== null)) {
      return currentLog
    }
    
    // Try previous set (most common case - use same weight for next set)
    if (setNumber > 1) {
      const prevLog = localLogs.get(setNumber - 1)
      if (prevLog && (prevLog.weight_kg !== null || prevLog.reps_completed !== null || prevLog.steps_completed !== null)) {
        return prevLog
      }
    }
    
    // Try any logged set from most recent to oldest
    for (let i = setNumber - 1; i >= 1; i--) {
      const log = localLogs.get(i)
      if (log && (log.weight_kg !== null || log.reps_completed !== null || log.steps_completed !== null)) {
        return log
      }
    }
    
    return null
  }

  // Open wheel picker for a set
  const openWheelPicker = (setNumber: number, targetReps: string, restBracket?: string) => {
    const mode = isStepsExercise ? 'steps' : 'weight-reps'
    setWheelPicker({ open: true, setNumber, targetReps, restBracket, mode })
  }

  const handleExerciseSwap = async (newExerciseName: string, isCustom: boolean, customExerciseId?: string) => {
    if (!clientId) return

    // Optimistically flip the UI so the user sees the swap immediately.
    setCurrentExerciseName(newExerciseName)
    setShowSwapModal(false)
    if (onExerciseSwap) onExerciseSwap(exerciseId, newExerciseName, isCustom)

    // Audit log — independent of session persistence.
    supabase
      .from('exercise_substitutions')
      .insert({
        original_exercise_id: workoutExerciseId || null,
        original_exercise_name: exerciseName,
        substituted_exercise_name: newExerciseName,
        is_custom: isCustom,
        custom_exercise_id: customExerciseId || null,
      })
      .then(({ error }) => {
        if (error) console.error('[swap] audit-log insert failed:', error)
      })

    // Persist the per-session swap so it survives a page reload, even if
    // no sets are logged afterward. Without this, the swap only survived
    // if at least one set_log got written carrying swapped_exercise_name.
    if (workoutId && scheduledDate && workoutExerciseId) {
      try {
        const res = await fetch('/api/workouts/swap-exercise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workoutId,
            scheduledDate,
            workoutExerciseId,
            substitutedExerciseName: newExerciseName,
            isCustom,
            customExerciseId: customExerciseId || null,
          }),
        })
        if (!res.ok) {
          console.error('[swap] persist failed:', await res.text())
        }
      } catch (e) {
        console.error('[swap] persist threw:', e)
      }
    }
  }

  const formatIntensity = (type: string, value: string) => {
    switch (type) {
      case 'rir': return `${value} RIR`
      case 'rpe': return `RPE ${value}`
      case 'percentage': return `${value}%`
      case 'time': return `${value}s`
      case 'failure': return 'To Failure'
      default: return value
    }
  }

  const hasTutorial = tutorialUrl || (tutorialSteps && tutorialSteps.length > 0)

  // ---------- Skip handlers ----------
  const handleConfirmSkip = async (next: SkipState) => {
    if (!workoutId || !scheduledDate || !workoutExerciseId) {
      console.warn('[skip] missing workoutId/scheduledDate/workoutExerciseId — cannot persist skip')
      return
    }
    setSkipSubmitting(true)
    try {
      const res = await fetch('/api/workouts/skip-exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutId,
          scheduledDate,
          workoutExerciseId,
          exerciseName: currentExerciseName,
          reasonCategory: next.reasonCategory,
          reasonDetails: next.reasonDetails,
        }),
      })
      if (!res.ok) throw new Error('skip failed')
      setSkip(next)
      onSkipChange?.(exerciseId, next)
      setShowSkipModal(false)
    } catch (e) {
      console.error('[skip] save failed:', e)
      alert('Could not save skip — please try again.')
    } finally {
      setSkipSubmitting(false)
    }
  }

  const handleUndoSkip = async () => {
    if (!workoutId || !scheduledDate || !workoutExerciseId) return
    setSkipSubmitting(true)
    try {
      const res = await fetch('/api/workouts/skip-exercise', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutId, scheduledDate, workoutExerciseId }),
      })
      if (!res.ok) throw new Error('undo skip failed')
      setSkip(null)
      onSkipChange?.(exerciseId, null)
    } catch (e) {
      console.error('[skip] undo failed:', e)
    } finally {
      setSkipSubmitting(false)
    }
  }

  // Skipped card — slim, distinct, with undo. Bypasses the normal sets UI.
  if (skip) {
    const categoryLabel =
      skip.reasonCategory === 'time'
        ? 'Short on time'
        : skip.reasonCategory
        ? skip.reasonCategory.charAt(0).toUpperCase() + skip.reasonCategory.slice(1)
        : null
    return (
      <>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <span className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-500 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-sm text-zinc-400 line-through decoration-zinc-600 break-words">
                  {currentExerciseName}
                </h3>
                <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] rounded shrink-0 inline-flex items-center gap-1">
                  <Ban className="w-3 h-3" />
                  Skipped
                </span>
              </div>
              {(categoryLabel || skip.reasonDetails) && (
                <p className="text-xs text-zinc-500 mt-1">
                  {categoryLabel && <span className="text-zinc-400">{categoryLabel}</span>}
                  {categoryLabel && skip.reasonDetails && <span className="text-zinc-600"> · </span>}
                  {skip.reasonDetails && <span className="italic">{skip.reasonDetails}</span>}
                </p>
              )}
            </div>
            <button
              onClick={handleUndoSkip}
              disabled={skipSubmitting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition-colors shrink-0 disabled:opacity-50"
              aria-label="Undo skip"
            >
              {skipSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Undo
            </button>
          </div>
        </div>

        {showSkipModal && (
          <SkipExerciseModal
            exerciseName={currentExerciseName}
            initial={skip}
            submitting={skipSubmitting}
            onConfirm={handleConfirmSkip}
            onClose={() => setShowSkipModal(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {/* Main Row - Always visible */}
        <div 
          className="p-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {/* Top Row: Number + Name + Actions */}
          <div className="flex items-center gap-2">
            {/* Exercise Number */}
            <span className="w-7 h-7 rounded-lg bg-yellow-400/10 text-yellow-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {index + 1}
            </span>
            
            {/* Exercise Name */}
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2 break-words">{currentExerciseName}</h3>
              {currentExerciseName !== exerciseName && (
                <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded flex-shrink-0">
                  Swapped
                </span>
              )}
              {supersetGroup && (
                <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] rounded flex-shrink-0">
                  SS{supersetGroup}
                </span>
              )}
            </div>
            
            {/* History Button — opens drawer with last 5 sessions */}
            <button
              onClick={async (e) => {
                e.stopPropagation()
                const next = !historyOpen
                setHistoryOpen(next)
                if (next && !historyLoaded) {
                  setHistoryLoading(true)
                  try {
                    const res = await fetch(
                      `/api/exercise-history?exercise=${encodeURIComponent(currentExerciseName)}&limit=5`
                    )
                    if (res.ok) {
                      const json = await res.json()
                      setHistorySessions(json.sessions || [])
                    }
                  } catch {
                    // silent; drawer just shows empty
                  }
                  setHistoryLoaded(true)
                  setHistoryLoading(false)
                }
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors flex-shrink-0 ${
                historyOpen
                  ? 'bg-yellow-400/20 text-yellow-400'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-yellow-400'
              }`}
              title="Your past sessions of this exercise"
              aria-label="Show exercise history"
              aria-expanded={historyOpen}
            >
              <History className="w-3 h-3" />
              <span className="hidden sm:inline">History</span>
            </button>

            {/* Swap Button — more prominent so clients know they can swap */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowSwapModal(true)
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-yellow-400 text-[10px] font-medium transition-colors flex-shrink-0"
              title="Swap this exercise for another"
              aria-label="Swap exercise"
            >
              <ArrowLeftRight className="w-3 h-3" />
              <span className="hidden sm:inline">Swap</span>
            </button>

            {/* Skip Button — "I can't / didn't do this exercise today" */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowSkipModal(true)
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-orange-400 text-[10px] font-medium transition-colors flex-shrink-0"
              title="Skip this exercise (e.g. injury, equipment, time)"
              aria-label="Skip exercise"
            >
              <Ban className="w-3 h-3" />
              <span className="hidden sm:inline">Skip</span>
            </button>

            {/* Tutorial Icon Button */}
            <div onClick={e => e.stopPropagation()}>
              <TutorialModal
                exerciseName={currentExerciseName}
                videoUrl={tutorialUrl}
                steps={tutorialSteps}
              />
            </div>
            
            {/* Expand Arrow */}
            <button className="p-1 text-zinc-500 hover:text-white transition-colors flex-shrink-0">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          
          {/* Bottom Row: Sets × Reps | Intensity | Weight (or duration for cardio) */}
          <div className="flex items-center gap-1.5 mt-1.5 ml-9 text-xs flex-wrap">
            {isCardioExercise ? (
              /* Cardio: show duration/distance + zone if set */
              <>
                {sets[0]?.cardio_value && (
                  <span className="text-yellow-400 font-medium">
                    {sets[0].cardio_value} {sets[0].cardio_unit || 'min'}
                  </span>
                )}
                {sets[0]?.heart_rate_zone && (
                  <>
                    {sets[0]?.cardio_value && <span className="text-zinc-600">•</span>}
                    <span className="text-orange-400 font-medium">
                      {sets[0].heart_rate_zone}
                    </span>
                  </>
                )}
                {!sets[0]?.cardio_value && !sets[0]?.heart_rate_zone && (
                  <span className="text-yellow-400 font-medium">Complete</span>
                )}
              </>
            ) : (
              /* Strength: show sets × reps · intensity · weight + previous */
              <>
                <span className="text-white font-medium">
                  {sets.length} × {sets[0]?.reps || '-'}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-yellow-400">
                  {intensitySummary}
                </span>
                {/* Show logged weight (green) or previous weight (gray) or calculated weight */}
                {(() => {
                  // Check if any set is logged this session
                  const loggedWeight = Array.from(localLogs.values()).find(l => l.weight_kg !== null)?.weight_kg
                  // Get previous session weight
                  const prevWeight = previousLogs.find(p => p.weight_kg)?.weight_kg
                  
                  if (loggedWeight) {
                    return (
                      <>
                        <span className="text-zinc-600">•</span>
                        <span className="text-green-400 font-medium">{loggedWeight}kg ✓</span>
                      </>
                    )
                  } else if (prevWeight) {
                    return (
                      <>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-400">Last: {prevWeight}kg</span>
                      </>
                    )
                  } else if (calculatedWeight) {
                    return (
                      <>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-500">{calculatedWeight}kg</span>
                      </>
                    )
                  }
                  return null
                })()}
              </>
            )}
          </div>
          
          {notes && !expanded && (
            <p className="text-zinc-500 text-[10px] mt-1 ml-9 line-clamp-1">{notes}</p>
          )}
        </div>
        
        {/* Exercise history drawer */}
        {historyOpen && (
          <div className="border-t border-zinc-800 bg-zinc-950/70 px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wider">
                Last sessions
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setHistoryOpen(false)
                }}
                className="p-1 text-zinc-500 hover:text-white"
                aria-label="Close history"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {historyLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
              </div>
            ) : historySessions.length === 0 ? (
              <p className="text-xs text-zinc-500 py-2">
                No previous sessions logged for this exercise yet.
              </p>
            ) : (
              <div className="space-y-2">
                {historySessions.map((s) => {
                  const dateStr = s.date
                    ? new Date(s.date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })
                    : 'Earlier'
                  const bestSet = s.sets.reduce(
                    (best, cur) =>
                      cur.weight * cur.reps > best.weight * best.reps ? cur : best,
                    s.sets[0]
                  )
                  return (
                    <div
                      key={s.workoutLogId}
                      className="flex items-center justify-between gap-3 bg-zinc-900 rounded-lg px-2.5 py-1.5"
                    >
                      <span className="text-[11px] text-zinc-500 flex-shrink-0 w-20">
                        {dateStr}
                      </span>
                      <div className="flex-1 flex flex-wrap gap-1 justify-end">
                        {s.sets.map((set) => (
                          <span
                            key={set.setNumber}
                            className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums ${
                              set === bestSet
                                ? 'bg-yellow-400/15 text-yellow-400 font-semibold'
                                : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            {set.weight}×{set.reps}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Expanded Sets */}
        {expanded && (
          <div className="border-t border-zinc-800 bg-zinc-950/50">
            {/* Cardio-only display - single completion button instead of multiple sets */}
            {isCardioExercise && (
              <div className="px-3 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-zinc-400 text-sm flex items-center gap-2">
                    {sets[0]?.cardio_value && (
                      <span>{sets[0].cardio_value} {sets[0].cardio_unit || 'min'}</span>
                    )}
                    {sets[0]?.heart_rate_zone && (
                      <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">
                        {sets[0].heart_rate_zone}
                      </span>
                    )}
                    {!sets[0]?.cardio_value && !sets[0]?.heart_rate_zone && (
                      <span>Complete workout</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // Mark as done by setting reps to 1
                      const log = localLogs.get(1)
                      const newValue = log?.reps_completed ? null : 1
                      setLocalLogs(prev => {
                        const newMap = new Map(prev)
                        newMap.set(1, { set_number: 1, weight_kg: null, reps_completed: newValue })
                        return newMap
                      })
                      onLogUpdate(exerciseId, 1, null, newValue)
                    }}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all active:scale-95 ${
                      localLogs.get(1)?.reps_completed
                        ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                        : 'bg-yellow-400 text-black'
                    }`}
                  >
                    {localLogs.get(1)?.reps_completed ? (
                      <span className="flex items-center gap-2">
                        <Check className="w-5 h-5" />
                        Done
                      </span>
                    ) : (
                      'Mark Complete'
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {/* Regular Set Rows (non-cardio) */}
            {!isCardioExercise && sets.map((set) => {
              const log = localLogs.get(set.set_number)
              // previousLogs is keyed by the EFFECTIVE exercise name in
              // WorkoutClient (swap-aware), so this prop already reflects
              // the swapped exercise's history when applicable.
              const prevLog = previousLogs.find(p => p.set_number === set.set_number)
              const setSkipped = log?.is_skipped === true
              const isLogged = !setSkipped && (isStepsExercise
                ? (log?.steps_completed !== null && log?.steps_completed !== undefined)
                : (log?.reps_completed !== null && log?.reps_completed !== undefined))

              // Display values: logged > previous > calculated > placeholder
              const displayWeight = log?.weight_kg ?? prevLog?.weight_kg ?? calculatedWeight ?? null
              const displayReps = log?.reps_completed ?? prevLog?.reps_completed ?? null
              const displaySteps = log?.steps_completed ?? null

              // Has previous data to show (but not logged yet)
              const hasPreviousData = !isLogged && !setSkipped && (prevLog?.weight_kg || prevLog?.reps_completed)

              return (
                <div
                  key={set.set_number}
                  className={`px-3 py-2 border-t border-zinc-800/50 first:border-t-0 ${
                    setSkipped ? 'bg-orange-500/5' : isLogged ? 'bg-green-500/5' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Set number + status */}
                    <div className="flex items-center gap-1.5 min-w-[40px]">
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center font-semibold text-xs ${
                        setSkipped ? 'bg-zinc-800 text-zinc-500 line-through decoration-zinc-600' : 'bg-zinc-800 text-white'
                      }`}>
                        {set.set_number}
                      </span>
                      {isLogged && <Check className="w-3.5 h-3.5 text-green-500" />}
                      {setSkipped && <Ban className="w-3.5 h-3.5 text-orange-400" />}
                    </div>

                    {/* Target info — dimmed when skipped */}
                    <div className={`text-[10px] flex-1 ${setSkipped ? 'text-zinc-600 line-through decoration-zinc-700' : 'text-zinc-500'}`}>
                      {isStepsExercise ? `${set.reps} steps` : `${set.reps} @ ${formatIntensity(set.intensity_type, set.intensity_value)}`}
                    </div>

                    {/* Right cluster: per-set Skip button + log/skipped state */}
                    <div className="flex items-center gap-1.5">
                      {/* Per-set skip toggle. Logging a value clears it; tapping
                          this clears any logged value. Mutually exclusive. */}
                      {onSetSkipToggle && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onSetSkipToggle(exerciseId, set.set_number, !setSkipped)
                          }}
                          aria-label={setSkipped ? 'Undo skip set' : 'Skip set'}
                          title={setSkipped ? 'Undo skip' : 'Skip this set'}
                          className={`p-2 rounded-md transition-colors ${
                            setSkipped
                              ? 'bg-orange-500/20 text-orange-400'
                              : 'text-zinc-500 hover:text-orange-400 hover:bg-zinc-800'
                          }`}
                        >
                          {setSkipped ? <RotateCcw className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                        </button>
                      )}

                      {/* Tappable log button / skipped state with last weight */}
                      <div className="flex flex-col items-end">
                        {setSkipped ? (
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
                            <Ban className="w-3.5 h-3.5 text-orange-400" />
                            <span className="text-xs font-medium text-orange-400">Skipped</span>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openWheelPicker(set.set_number, set.reps, set.rest_bracket)
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all active:scale-95 ${
                              isLogged
                                ? 'bg-green-500/20 border border-green-500/30'
                                : 'bg-zinc-700/50 border border-zinc-600/50 hover:bg-zinc-700'
                            }`}
                          >
                            {isStepsExercise ? (
                              <div className="text-center min-w-[60px]">
                                <span className={`font-bold text-sm ${isLogged ? 'text-green-400' : 'text-zinc-400'}`}>
                                  {displaySteps ?? '—'}
                                </span>
                                <span className="text-zinc-500 text-[10px] ml-0.5">steps</span>
                              </div>
                            ) : (
                              <>
                                <div className="text-center min-w-[40px]">
                                  <span className={`font-bold text-sm ${isLogged ? 'text-green-400' : 'text-zinc-400'}`}>
                                    {displayWeight ?? '—'}
                                  </span>
                                  <span className="text-zinc-500 text-[10px] ml-0.5">kg</span>
                                </div>
                                <span className="text-zinc-600 text-xs">×</span>
                                <div className="text-center min-w-[24px]">
                                  <span className={`font-bold text-sm ${isLogged ? 'text-green-400' : 'text-zinc-400'}`}>
                                    {displayReps ?? '—'}
                                  </span>
                                </div>
                              </>
                            )}
                          </button>
                        )}
                        {hasPreviousData && (
                          <span className="text-[9px] text-zinc-500 mt-0.5">Last week</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            
            {notes && (
              <div className="px-3 py-2 border-t border-zinc-800/50">
                <p className="text-zinc-500 text-[10px]">{notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Swap Exercise Modal */}
      {showSwapModal && clientId && (
        <SwapExerciseModal
          exerciseName={exerciseName}
          muscleGroup={muscleGroup}
          onSelect={handleExerciseSwap}
          onClose={() => setShowSwapModal(false)}
          clientId={clientId}
        />
      )}

      {/* Skip Exercise Modal */}
      {showSkipModal && (
        <SkipExerciseModal
          exerciseName={currentExerciseName}
          initial={skip}
          submitting={skipSubmitting}
          onConfirm={handleConfirmSkip}
          onClose={() => setShowSkipModal(false)}
        />
      )}
      
      {/* Wheel Picker Modal */}
      {(() => {
        const prevValues = getPreviousSetValues(wheelPicker.setNumber)
        return (
          <WheelPicker
            isOpen={wheelPicker.open}
            onClose={() => setWheelPicker({ open: false, setNumber: 0, targetReps: '', mode: 'weight-reps' })}
            onConfirm={handleWheelPickerConfirm}
            initialWeight={prevValues?.weight_kg}
            initialReps={prevValues?.reps_completed}
            initialSteps={prevValues?.steps_completed}
            targetReps={wheelPicker.targetReps}
            targetSteps={wheelPicker.targetReps}
            suggestedWeight={calculatedWeight}
            exerciseName={currentExerciseName}
            setNumber={wheelPicker.setNumber}
            mode={wheelPicker.mode}
          />
        )
      })()}
      
      {/* PR Celebration */}
      <PRCelebration
        isOpen={prCelebration.show}
        onClose={() => setPRCelebration({ show: false, weight: 0, reps: 0 })}
        exerciseName={currentExerciseName}
        weight={prCelebration.weight}
        reps={prCelebration.reps}
        previousBest={personalBest ? { weight: personalBest.weight_kg, reps: personalBest.reps } : undefined}
      />
    </>
  )
}

// Memoize: ExerciseCard re-renders often during an active workout as the
// parent state churns with debounced saves. Shallow prop equality is enough
// here because callbacks from WorkoutClient are already stable refs.
const ExerciseCard = memo(ExerciseCardInner)
export default ExerciseCard
