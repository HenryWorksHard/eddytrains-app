'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, X, Check, Clock } from 'lucide-react'
import TutorialModal from './TutorialModal'
import { createClient } from '../../lib/supabase/client'

interface ExerciseSet {
  set_number: number
  reps: string
  intensity_type: string
  intensity_value: string
  rest_bracket?: string
  notes?: string
}

interface SetLog {
  set_number: number
  weight_kg: number | null
  reps_completed: number | null
}

interface Exercise {
  id: string
  name: string
  muscle_group: string
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
  onLogUpdate: (exerciseId: string, setNumber: number, weight: number | null, reps: number | null) => void
  onExerciseSwap?: (exerciseId: string, newExerciseName: string, isCustom: boolean) => void
  workoutExerciseId?: string
}

// Rest Timer Component
function RestTimer({ seconds, onComplete, onSkip }: { seconds: number; onComplete: () => void; onSkip: () => void }) {
  const [timeLeft, setTimeLeft] = useState(seconds)
  
  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete()
      return
    }
    
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)
    
    return () => clearInterval(timer)
  }, [timeLeft, onComplete])
  
  const progress = ((seconds - timeLeft) / seconds) * 100
  const minutes = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-8 text-center max-w-sm mx-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-yellow-400" />
          <span className="text-zinc-400 text-sm font-medium">Rest Timer</span>
        </div>
        
        {/* Circular Progress */}
        <div className="relative w-40 h-40 mx-auto mb-6">
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="#27272a"
              strokeWidth="8"
            />
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="#facc15"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 70}
              strokeDashoffset={2 * Math.PI * 70 * (1 - progress / 100)}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold text-white">
              {minutes}:{secs.toString().padStart(2, '0')}
            </span>
          </div>
        </div>
        
        <button
          onClick={onSkip}
          className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
        >
          Skip Rest
        </button>
      </div>
    </div>
  )
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
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-zinc-900 border border-zinc-700 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-lg font-semibold text-white">Swap Exercise</h3>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
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
              {/* Standard exercises */}
              {exercises.map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => onSelect(ex.name, false)}
                  className="w-full text-left px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl text-white transition-colors"
                >
                  {ex.name}
                </button>
              ))}
              
              {/* Client's custom exercises */}
              {customExercises.length > 0 && (
                <>
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mt-4 mb-2 px-1">
                    Your Custom Exercises
                  </div>
                  {customExercises.map((ex) => (
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
              
              {/* Other option */}
              <button
                onClick={() => setShowCustomInput(true)}
                className="w-full text-left px-4 py-3 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 rounded-xl text-yellow-400 transition-colors mt-4"
              >
                + Add Custom Exercise
              </button>
              
              {exercises.length === 0 && customExercises.length === 0 && (
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
  onLogUpdate,
  onExerciseSwap,
  workoutExerciseId
}: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [localLogs, setLocalLogs] = useState<Map<number, SetLog>>(new Map())
  const [restTimer, setRestTimer] = useState<{ active: boolean; seconds: number; setNumber: number }>({ active: false, seconds: 0, setNumber: 0 })
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [currentExerciseName, setCurrentExerciseName] = useState(exerciseName)
  const [clientId, setClientId] = useState<string | null>(null)
  const [muscleGroup, setMuscleGroup] = useState<string>('other')
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

  // Initialize from previous logs
  useEffect(() => {
    const logMap = new Map<number, SetLog>()
    previousLogs.forEach(log => {
      logMap.set(log.set_number, log)
    })
    setLocalLogs(logMap)
  }, [previousLogs])

  // Parse rest bracket to get seconds (e.g., "90-120" → 90)
  const parseRestBracket = (bracket?: string): number => {
    if (!bracket) return 90 // default
    const match = bracket.match(/^(\d+)/)
    return match ? parseInt(match[1]) : 90
  }

  const handleWeightChange = (setNumber: number, value: string) => {
    const weight = value === '' ? null : parseFloat(value)
    const current = localLogs.get(setNumber) || { set_number: setNumber, weight_kg: null, reps_completed: null }
    const updated = { ...current, weight_kg: weight }
    setLocalLogs(new Map(localLogs.set(setNumber, updated)))
    onLogUpdate(exerciseId, setNumber, weight, updated.reps_completed)
  }

  const handleRepsChange = (setNumber: number, value: string, restBracket?: string) => {
    const reps = value === '' ? null : parseInt(value)
    const current = localLogs.get(setNumber) || { set_number: setNumber, weight_kg: null, reps_completed: null }
    const updated = { ...current, reps_completed: reps }
    setLocalLogs(new Map(localLogs.set(setNumber, updated)))
    onLogUpdate(exerciseId, setNumber, updated.weight_kg, reps)
    
    // Start rest timer if reps were logged
    if (reps !== null && reps > 0) {
      const restSeconds = parseRestBracket(restBracket)
      setRestTimer({ active: true, seconds: restSeconds, setNumber })
    }
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
      case 'failure': return 'To Failure'
      default: return value
    }
  }

  const hasTutorial = tutorialUrl || (tutorialSteps && tutorialSteps.length > 0)

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {/* Main Row - Always visible */}
        <div 
          className="p-4 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {/* Top Row: Number + Name + Actions */}
          <div className="flex items-center gap-3">
            {/* Exercise Number */}
            <span className="w-8 h-8 rounded-lg bg-yellow-400/10 text-yellow-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
              {index + 1}
            </span>
            
            {/* Exercise Name */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <h3 className="font-semibold text-white truncate">{currentExerciseName}</h3>
              {currentExerciseName !== exerciseName && (
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded flex-shrink-0">
                  Swapped
                </span>
              )}
              {supersetGroup && (
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded flex-shrink-0">
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
              className="p-2 text-zinc-500 hover:text-yellow-400 transition-colors flex-shrink-0"
              title="Swap Exercise"
            >
              <RefreshCw className="w-4 h-4" />
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
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
          
          {/* Bottom Row: Sets × Reps | Intensity | Weight */}
          <div className="flex items-center gap-2 mt-2 ml-11 text-sm flex-wrap">
            <span className="text-white font-medium">
              {sets.length} sets × {sets[0]?.reps || '-'}
            </span>
            <span className="text-zinc-600">|</span>
            <span className="text-yellow-400">
              {intensitySummary}
            </span>
            {calculatedWeight && (
              <>
                <span className="text-zinc-600">|</span>
                <span className="text-green-400 font-medium">
                  {calculatedWeight}kg
                </span>
              </>
            )}
          </div>
          
          {notes && !expanded && (
            <p className="text-zinc-500 text-xs mt-2 ml-11">{notes}</p>
          )}
        </div>
        
        {/* Expanded Sets */}
        {expanded && (
          <div className="border-t border-zinc-800 bg-zinc-950/50">
            {/* Header Row */}
            <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs text-zinc-500 uppercase tracking-wider">
              <div>Set</div>
              <div>Target</div>
              <div>Weight (kg)</div>
              <div>Reps Done</div>
            </div>
            
            {/* Set Rows */}
            {sets.map((set) => {
              const log = localLogs.get(set.set_number)
              const isLogged = log?.reps_completed !== null && log?.reps_completed !== undefined
              return (
                <div 
                  key={set.set_number}
                  className={`grid grid-cols-4 gap-2 px-4 py-3 border-t border-zinc-800/50 items-center ${isLogged ? 'bg-green-500/5' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{set.set_number}</span>
                    {isLogged && <Check className="w-4 h-4 text-green-500" />}
                  </div>
                  <div className="text-zinc-400 text-sm">
                    {set.reps} @ {formatIntensity(set.intensity_type, set.intensity_value)}
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder={calculatedWeight ? `${calculatedWeight}` : '-'}
                    value={log?.weight_kg ?? ''}
                    onChange={(e) => handleWeightChange(set.set_number, e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-center font-medium focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    onClick={e => e.stopPropagation()}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={set.reps.split('-')[0] || '-'}
                    value={log?.reps_completed ?? ''}
                    onChange={(e) => handleRepsChange(set.set_number, e.target.value, set.rest_bracket)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-center font-medium focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              )
            })}
            
            {notes && (
              <div className="px-4 py-3 border-t border-zinc-800/50">
                <p className="text-zinc-500 text-xs">{notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Rest Timer Overlay */}
      {restTimer.active && (
        <RestTimer
          seconds={restTimer.seconds}
          onComplete={() => setRestTimer({ active: false, seconds: 0, setNumber: 0 })}
          onSkip={() => setRestTimer({ active: false, seconds: 0, setNumber: 0 })}
        />
      )}
      
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
    </>
  )
}
