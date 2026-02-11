'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp, Check } from 'lucide-react'
import { createClient } from '../lib/supabase/client'

interface ExerciseSet {
  setNumber: number
  reps: string
  intensityType: string
  intensityValue: string
}

interface Exercise {
  id: string
  name: string
  orderIndex: number
  notes?: string
  supersetGroup?: string
  sets: ExerciseSet[]
}

interface SetLog {
  setNumber: number
  weight: number | null
  reps: number | null
}

interface ExerciseLoggerProps {
  exercise: Exercise
  index: number
  workoutId: string
  scheduledDate: string
  getOrCreateWorkoutLog: (workoutId: string) => Promise<string | null>
  existingLogId?: string
  onDataChange?: () => void
}

export default function ExerciseLogger({
  exercise,
  index,
  workoutId,
  scheduledDate,
  getOrCreateWorkoutLog,
  existingLogId,
  onDataChange
}: ExerciseLoggerProps) {
  const supabase = createClient()
  const [expanded, setExpanded] = useState(false)
  const [logs, setLogs] = useState<Map<number, SetLog>>(new Map())
  const [saving, setSaving] = useState(false)
  const [loadedExisting, setLoadedExisting] = useState(false)

  // Load existing logs when we have a workout log ID
  useEffect(() => {
    if (existingLogId && !loadedExisting) {
      loadExistingLogs(existingLogId)
    }
  }, [existingLogId])

  const loadExistingLogs = async (logId: string) => {
    const { data: existingSetLogs } = await supabase
      .from('set_logs')
      .select('set_number, weight_kg, reps_completed')
      .eq('workout_log_id', logId)
      .eq('exercise_id', exercise.id)

    if (existingSetLogs && existingSetLogs.length > 0) {
      const newLogs = new Map<number, SetLog>()
      existingSetLogs.forEach(sl => {
        newLogs.set(sl.set_number, {
          setNumber: sl.set_number,
          weight: sl.weight_kg,
          reps: sl.reps_completed
        })
      })
      setLogs(newLogs)
      setExpanded(true) // Auto-expand if has data
    }
    setLoadedExisting(true)
  }

  // Count logged sets
  const loggedCount = Array.from(logs.values()).filter(l => l.weight !== null || l.reps !== null).length
  const totalSets = exercise.sets.length
  const allLogged = loggedCount === totalSets && totalSets > 0

  // Format intensity display
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

  // Save a set
  const saveSet = useCallback(async (setNumber: number, weight: number | null, reps: number | null) => {
    // Update local state immediately
    setLogs(prev => {
      const newLogs = new Map(prev)
      newLogs.set(setNumber, { setNumber, weight, reps })
      return newLogs
    })
    
    // Notify parent of data change
    onDataChange?.()

    // Debounced save to database
    setSaving(true)
    try {
      const workoutLogId = await getOrCreateWorkoutLog(workoutId)
      if (!workoutLogId) {
        setSaving(false)
        return
      }

      await supabase
        .from('set_logs')
        .upsert({
          workout_log_id: workoutLogId,
          exercise_id: exercise.id,
          set_number: setNumber,
          weight_kg: weight,
          reps_completed: reps
        }, {
          onConflict: 'workout_log_id,exercise_id,set_number'
        })
    } catch (err) {
      console.error('Failed to save set:', err)
    }
    setSaving(false)
  }, [workoutId, exercise.id, getOrCreateWorkoutLog])

  return (
    <div className={`bg-zinc-800/50 rounded-xl overflow-hidden ${allLogged ? 'ring-1 ring-green-500/30' : ''}`}>
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
            allLogged ? 'bg-green-500/20 text-green-400' : 'bg-yellow-400/10 text-yellow-400'
          }`}>
            {allLogged ? <Check className="w-4 h-4" /> : index + 1}
          </span>
          <div className="text-left">
            <h4 className="font-medium text-white text-sm">{exercise.name}</h4>
            <p className="text-zinc-500 text-xs">
              {totalSets} sets × {exercise.sets[0]?.reps || '?'} · {formatIntensity(exercise.sets[0]?.intensityType, exercise.sets[0]?.intensityValue)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {loggedCount > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded ${
              allLogged ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-400'
            }`}>
              {loggedCount}/{totalSets}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </button>

      {/* Expanded - set inputs */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {exercise.sets.map((set) => {
            const log = logs.get(set.setNumber)
            const isLogged = log?.weight !== null || log?.reps !== null
            
            return (
              <div 
                key={set.setNumber}
                className={`flex items-center gap-2 p-2 rounded-lg ${
                  isLogged ? 'bg-green-500/10' : 'bg-zinc-800'
                }`}
              >
                {/* Set number */}
                <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                  isLogged ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-400'
                }`}>
                  {set.setNumber}
                </span>

                {/* Target info */}
                <span className="text-zinc-500 text-xs flex-shrink-0">
                  {set.reps} @ {formatIntensity(set.intensityType, set.intensityValue)}
                </span>

                <div className="flex-1" />

                {/* Weight input */}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={log?.weight ?? ''}
                    onChange={(e) => {
                      const weight = e.target.value === '' ? null : parseFloat(e.target.value)
                      saveSet(set.setNumber, weight, log?.reps ?? null)
                    }}
                    className="w-14 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  />
                  <span className="text-zinc-500 text-xs">kg</span>
                </div>

                <span className="text-zinc-600">×</span>

                {/* Reps input */}
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={log?.reps ?? ''}
                  onChange={(e) => {
                    const reps = e.target.value === '' ? null : parseInt(e.target.value)
                    saveSet(set.setNumber, log?.weight ?? null, reps)
                  }}
                  className="w-12 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-yellow-400"
                />
              </div>
            )
          })}
          
          {exercise.notes && (
            <p className="text-zinc-500 text-xs italic px-2 pt-1">{exercise.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}
