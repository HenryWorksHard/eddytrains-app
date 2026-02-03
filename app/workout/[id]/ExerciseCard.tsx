'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import TutorialModal from './TutorialModal'

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
  onLogUpdate
}: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [localLogs, setLocalLogs] = useState<Map<number, SetLog>>(new Map())

  // Initialize from previous logs
  useEffect(() => {
    const logMap = new Map<number, SetLog>()
    previousLogs.forEach(log => {
      logMap.set(log.set_number, log)
    })
    setLocalLogs(logMap)
  }, [previousLogs])

  const handleWeightChange = (setNumber: number, value: string) => {
    const weight = value === '' ? null : parseFloat(value)
    const current = localLogs.get(setNumber) || { set_number: setNumber, weight_kg: null, reps_completed: null }
    const updated = { ...current, weight_kg: weight }
    setLocalLogs(new Map(localLogs.set(setNumber, updated)))
    onLogUpdate(exerciseId, setNumber, weight, updated.reps_completed)
  }

  const handleRepsChange = (setNumber: number, value: string) => {
    const reps = value === '' ? null : parseInt(value)
    const current = localLogs.get(setNumber) || { set_number: setNumber, weight_kg: null, reps_completed: null }
    const updated = { ...current, reps_completed: reps }
    setLocalLogs(new Map(localLogs.set(setNumber, updated)))
    onLogUpdate(exerciseId, setNumber, updated.weight_kg, reps)
  }

  const formatIntensity = (type: string, value: string) => {
    switch (type) {
      case 'rir': return `${value} RIR`
      case 'rpe': return `RPE ${value}`
      case 'percentage': return `${value}%`
      default: return value
    }
  }

  const hasTutorial = tutorialUrl || (tutorialSteps && tutorialSteps.length > 0)

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      {/* Main Row - Always visible */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          {/* Exercise Number */}
          <span className="w-8 h-8 rounded-lg bg-yellow-400/10 text-yellow-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
            {index + 1}
          </span>
          
          {/* Exercise Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white truncate">{exerciseName}</h3>
              {supersetGroup && (
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                  SS{supersetGroup}
                </span>
              )}
            </div>
            
            {/* Set Summary */}
            <div className="flex items-center gap-3 mt-2 text-sm">
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
          </div>
          
          {/* Tutorial + Expand */}
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <TutorialModal
              exerciseName={exerciseName}
              videoUrl={tutorialUrl}
              steps={tutorialSteps}
            />
          </div>
          
          <button className="p-2 text-zinc-500 hover:text-white transition-colors">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
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
            return (
              <div 
                key={set.set_number}
                className="grid grid-cols-4 gap-2 px-4 py-3 border-t border-zinc-800/50 items-center"
              >
                <div className="text-white font-medium">{set.set_number}</div>
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
                  onChange={(e) => handleRepsChange(set.set_number, e.target.value)}
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
  )
}
