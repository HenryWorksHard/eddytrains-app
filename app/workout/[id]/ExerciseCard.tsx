'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, X, Check, Trophy, Search } from 'lucide-react'
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
  personalBest?: PersonalBest | null
  onLogUpdate: (exerciseId: string, setNumber: number, weight: number | null, reps: number | null) => void
  onExerciseSwap?: (exerciseId: string, newExerciseName: string, isCustom: boolean) => void
  workoutExerciseId?: string
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800">
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
                autoFocus
              />
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
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

export default function ExerciseCard({
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
  personalBest,
  onLogUpdate,
  onExerciseSwap,
  workoutExerciseId
}: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [localLogs, setLocalLogs] = useState<Map<number, SetLog>>(new Map())
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [currentExerciseName, setCurrentExerciseName] = useState(exerciseName)
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

  // Initialize from previous logs - merge with existing to avoid losing freshly logged sets
  useEffect(() => {
    setLocalLogs(prev => {
      const newMap = new Map(prev)
      previousLogs.forEach(log => {
        // Only update if we don't have a more recent local entry
        const existing = newMap.get(log.set_number)
        if (!existing || (existing.weight_kg === null && existing.reps_completed === null)) {
          newMap.set(log.set_number, log)
        }
      })
      return newMap
    })
  }, [previousLogs])

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
    
    // Update local state immediately + cascade to subsequent sets (ladder behaviour)
    const newMap = new Map(localLogs)
    newMap.set(setNumber, updated)
    
    // Auto-fill subsequent sets with same values (ladder cascade)
    const totalSets = sets.length
    for (let i = setNumber + 1; i <= totalSets; i++) {
      const nextCurrent = newMap.get(i) || { set_number: i, weight_kg: null, reps_completed: null, steps_completed: null }
      if (steps !== undefined && steps !== null) {
        newMap.set(i, { ...nextCurrent, steps_completed: steps })
      } else {
        newMap.set(i, { ...nextCurrent, weight_kg: weight, reps_completed: reps })
      }
      // Also notify parent for each subsequent set
      onLogUpdate(exerciseId, i, weight, reps)
    }
    
    setLocalLogs(newMap)
    
    // Notify parent for current set
    onLogUpdate(exerciseId, setNumber, weight, reps)
    
    // Check for PR (only if we have personal best data and not steps)
    if (weight && reps && personalBest && isNewPR(weight, reps)) {
      setPRCelebration({ show: true, weight, reps })
      setSessionBest({ weight, reps })
    } else if (weight && reps) {
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
    
    // Log substitution (workout_log_id will be null - can be linked later if needed)
    await supabase
      .from('exercise_substitutions')
      .insert({
        original_exercise_id: workoutExerciseId || null,
        original_exercise_name: exerciseName,
        substituted_exercise_name: newExerciseName,
        is_custom: isCustom,
        custom_exercise_id: customExerciseId || null
      })
    
    setCurrentExerciseName(newExerciseName)
    setShowSwapModal(false)
    
    // Notify parent if callback exists
    if (onExerciseSwap) {
      onExerciseSwap(exerciseId, newExerciseName, isCustom)
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
              <h3 className="font-semibold text-white text-sm truncate">{currentExerciseName}</h3>
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
            
            {/* Swap Button */}
            <button 
              onClick={(e) => {
                e.stopPropagation()
                setShowSwapModal(true)
              }}
              className="p-1.5 text-zinc-500 hover:text-yellow-400 transition-colors flex-shrink-0"
              title="Swap Exercise"
            >
              <RefreshCw className="w-3.5 h-3.5" />
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
              /* Cardio: just show duration/distance */
              <span className="text-yellow-400 font-medium">
                {sets[0]?.cardio_value ? `${sets[0].cardio_value} ${sets[0].cardio_unit || 'min'}` : 'Complete'}
              </span>
            ) : (
              /* Strength: show sets × reps · intensity · weight */
              <>
                <span className="text-white font-medium">
                  {sets.length} × {sets[0]?.reps || '-'}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-yellow-400">
                  {intensitySummary}
                </span>
                {calculatedWeight && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="text-green-400 font-medium">
                      {calculatedWeight}kg
                    </span>
                  </>
                )}
              </>
            )}
          </div>
          
          {notes && !expanded && (
            <p className="text-zinc-500 text-[10px] mt-1 ml-9 line-clamp-1">{notes}</p>
          )}
        </div>
        
        {/* Expanded Sets */}
        {expanded && (
          <div className="border-t border-zinc-800 bg-zinc-950/50">
            {/* Cardio-only display - single completion button instead of multiple sets */}
            {isCardioExercise && (
              <div className="px-3 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-zinc-400 text-sm">
                    {sets[0]?.cardio_value ? (
                      <span>{sets[0].cardio_value} {sets[0].cardio_unit || 'min'}</span>
                    ) : (
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
              const isLogged = isStepsExercise 
                ? (log?.steps_completed !== null && log?.steps_completed !== undefined)
                : (log?.reps_completed !== null && log?.reps_completed !== undefined)
              return (
                <div 
                  key={set.set_number}
                  className={`px-3 py-2 border-t border-zinc-800/50 first:border-t-0 ${isLogged ? 'bg-green-500/5' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Set number + status */}
                    <div className="flex items-center gap-1.5 min-w-[40px]">
                      <span className="w-6 h-6 rounded-md bg-zinc-800 text-white flex items-center justify-center font-semibold text-xs">
                        {set.set_number}
                      </span>
                      {isLogged && <Check className="w-3.5 h-3.5 text-green-500" />}
                    </div>
                    
                    {/* Target info */}
                    <div className="text-zinc-500 text-[10px] flex-1">
                      {isStepsExercise ? `${set.reps} steps` : `${set.reps} @ ${formatIntensity(set.intensity_type, set.intensity_value)}`}
                    </div>
                    
                    {/* Tappable log button with last weight */}
                    <div className="flex flex-col items-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openWheelPicker(set.set_number, set.reps, set.rest_bracket)
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all active:scale-95 ${
                          isLogged 
                            ? 'bg-green-500/20 border border-green-500/30' 
                            : 'bg-yellow-400/10 border border-yellow-400/30 hover:bg-yellow-400/20'
                        }`}
                      >
                      {isStepsExercise ? (
                        /* Steps display */
                        <div className="text-center min-w-[60px]">
                          <span className={`font-bold text-sm ${isLogged ? 'text-green-400' : 'text-white'}`}>
                            {log?.steps_completed ?? '—'}
                          </span>
                          <span className="text-zinc-500 text-[10px] ml-0.5">steps</span>
                        </div>
                      ) : (
                        <>
                          {/* Weight display */}
                          <div className="text-center min-w-[40px]">
                            <span className={`font-bold text-sm ${isLogged ? 'text-green-400' : 'text-white'}`}>
                              {log?.weight_kg ?? (calculatedWeight || '—')}
                            </span>
                            <span className="text-zinc-500 text-[10px] ml-0.5">kg</span>
                          </div>
                          
                          <span className="text-zinc-600 text-xs">×</span>
                          
                          {/* Reps display */}
                          <div className="text-center min-w-[24px]">
                            <span className={`font-bold text-sm ${isLogged ? 'text-green-400' : 'text-white'}`}>
                              {log?.reps_completed ?? '—'}
                            </span>
                          </div>
                        </>
                      )}
                      </button>
                      {/* Show last used weight */}
                      {(() => {
                        const prevLog = previousLogs.find(p => p.set_number === set.set_number)
                        return prevLog?.weight_kg ? (
                          <span className="text-[9px] text-zinc-500 mt-0.5">Last: {prevLog.weight_kg}kg</span>
                        ) : null
                      })()}
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
