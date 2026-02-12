'use client'

import { X, AlertTriangle, Wind, Dumbbell } from 'lucide-react'
import exercisesData from '@/data/exercises.json'

interface ExerciseTutorialProps {
  exerciseId: string
  onClose: () => void
}

export default function ExerciseTutorial({ exerciseId, onClose }: ExerciseTutorialProps) {
  const exercise = exercisesData.exercises.find(ex => ex.id === exerciseId)

  if (!exercise) {
    return null
  }

  const tutorial = exercise.tutorial

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-yellow-400/10 flex items-center justify-center">
                <Dumbbell className="w-7 h-7 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{exercise.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-zinc-400 capitalize">{exercise.category}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-sm text-zinc-400 capitalize">{exercise.difficulty}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Muscles */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Target Muscles</h3>
            <div className="flex flex-wrap gap-2">
              {exercise.primaryMuscles.map((muscle) => (
                <span key={muscle} className="px-3 py-1.5 bg-yellow-400/10 text-yellow-400 rounded-full text-sm border border-yellow-400/20">
                  {muscle.replace('_', ' ')}
                </span>
              ))}
              {exercise.secondaryMuscles?.map((muscle) => (
                <span key={muscle} className="px-3 py-1.5 bg-zinc-800 text-zinc-400 rounded-full text-sm border border-zinc-700">
                  {muscle.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>

          {/* Equipment */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Equipment</h3>
            <div className="flex flex-wrap gap-2">
              {exercise.equipment.map((eq) => (
                <span key={eq} className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-full text-sm">
                  {exercisesData.equipment.find(e => e.id === eq)?.label || eq}
                </span>
              ))}
            </div>
          </div>

          {/* Setup */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Setup</h3>
            <p className="text-zinc-300 leading-relaxed">{tutorial.setup}</p>
          </div>

          {/* Execution */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Execution</h3>
            <p className="text-zinc-300 leading-relaxed">{tutorial.execution}</p>
          </div>

          {/* Cues */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Key Cues</h3>
            <ul className="space-y-2">
              {tutorial.cues.map((cue, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="text-zinc-300">{cue}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Common Mistakes */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Common Mistakes
            </h3>
            <ul className="space-y-2">
              {tutorial.commonMistakes.map((mistake, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-400 mt-2 flex-shrink-0" />
                  <span className="text-zinc-300">{mistake}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Breathing */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Wind className="w-4 h-4 text-blue-400" />
              Breathing Pattern
            </h3>
            <p className="text-zinc-300 leading-relaxed">{tutorial.breathingPattern}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
