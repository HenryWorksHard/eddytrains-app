'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Calendar, Dumbbell } from 'lucide-react'

interface ExerciseLog {
  name: string
  sets: { set: number; weight: number; reps: number }[]
}

interface WorkoutLog {
  id: string
  date: string
  workoutName: string
  programName: string
  category: string
  exercises: ExerciseLog[]
}

interface HistoryClientProps {
  history: WorkoutLog[]
}

// Get category color
function getCategoryColor(category: string) {
  switch (category) {
    case 'strength': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'cardio': return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'hyrox': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    case 'hybrid': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    default: return 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30'
  }
}

// Format date nicely
function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  
  return date.toLocaleDateString(undefined, { 
    weekday: 'short',
    day: 'numeric', 
    month: 'short' 
  })
}

// Format time
function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  })
}

// Group workouts by date
function groupByDate(logs: WorkoutLog[]) {
  const groups: { date: string; workouts: WorkoutLog[] }[] = []
  
  logs.forEach(log => {
    const dateKey = new Date(log.date).toDateString()
    const existing = groups.find(g => new Date(g.date).toDateString() === dateKey)
    
    if (existing) {
      existing.workouts.push(log)
    } else {
      groups.push({ date: log.date, workouts: [log] })
    }
  })
  
  return groups
}

function WorkoutCard({ workout }: { workout: WorkoutLog }) {
  const [expanded, setExpanded] = useState(false)
  
  // Calculate total volume
  const totalVolume = workout.exercises.reduce((total, ex) => {
    return total + ex.sets.reduce((setTotal, set) => setTotal + (set.weight * set.reps), 0)
  }, 0)
  
  const totalSets = workout.exercises.reduce((total, ex) => total + ex.sets.length, 0)
  
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Dumbbell className="w-4 h-4 text-green-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-white text-sm truncate">{workout.workoutName}</h3>
              <p className="text-zinc-500 text-xs truncate">{workout.programName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="text-white text-xs font-medium block">{totalSets} sets</span>
              <span className="text-zinc-500 text-[10px]">{Math.round(totalVolume / 1000)}k kg</span>
            </div>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            )}
          </div>
        </div>
      </button>
      
      {expanded && (
        <div className="border-t border-zinc-800 bg-zinc-950/50">
          {workout.exercises.map((exercise, idx) => (
            <div key={idx} className="px-3 py-2 border-t border-zinc-800/50 first:border-t-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white text-xs font-medium">{exercise.name}</span>
                <span className="text-zinc-500 text-[10px]">{exercise.sets.length} sets</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {exercise.sets.map((set, setIdx) => (
                  <span 
                    key={setIdx}
                    className="px-2 py-0.5 bg-zinc-800 rounded text-[10px] text-zinc-300"
                  >
                    {set.weight}kg × {set.reps}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HistoryClient({ history }: HistoryClientProps) {
  const groups = groupByDate(history)
  
  if (history.length === 0) {
    return (
      <div className="p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-6 h-6 text-zinc-600" />
          </div>
          <h3 className="text-white font-semibold text-sm mb-1">No History Yet</h3>
          <p className="text-zinc-500 text-xs">Complete your first workout to see it here!</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="p-4 space-y-4">
      {groups.map((group, groupIdx) => (
        <div key={groupIdx}>
          {/* Date header */}
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-xs font-medium text-zinc-400">
              {formatDate(group.date)}
            </span>
            <span className="text-[10px] text-zinc-600">
              {formatTime(group.date)}
            </span>
          </div>
          
          {/* Workouts for this date */}
          <div className="space-y-2">
            {group.workouts.map((workout) => (
              <WorkoutCard key={workout.id} workout={workout} />
            ))}
          </div>
        </div>
      ))}
      
      {/* Load more indicator */}
      {history.length >= 50 && (
        <p className="text-center text-zinc-500 text-xs py-2">
          Showing last 50 workouts
        </p>
      )}
    </div>
  )
}
