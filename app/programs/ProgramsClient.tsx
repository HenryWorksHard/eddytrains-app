'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface ProgramWorkout {
  id: string
  name: string
  day_of_week: number | null
  order_index: number
  program_id: string
  finisher?: {
    id: string
    name: string
  } | null
}

interface ClientProgram {
  id: string
  program_id: string
  start_date: string
  end_date: string | null
  duration_weeks: number
  phase_name: string | null
  is_active: boolean
  program: {
    id: string
    name: string
    description?: string
    emoji?: string
    category?: string
  } | null
}

interface ProgramsClientProps {
  clientPrograms: ClientProgram[]
  programWorkoutsMap: Record<string, ProgramWorkout[]>
}

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dayAbbrev = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

export default function ProgramsClient({ clientPrograms, programWorkoutsMap }: ProgramsClientProps) {
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set())

  const toggleProgram = (programId: string) => {
    const newExpanded = new Set(expandedPrograms)
    if (newExpanded.has(programId)) {
      newExpanded.delete(programId)
    } else {
      newExpanded.add(programId)
    }
    setExpandedPrograms(newExpanded)
  }

  const getProgress = (cp: ClientProgram) => {
    const start = new Date(cp.start_date)
    const end = cp.end_date ? new Date(cp.end_date) : null
    const now = new Date()
    
    if (!end) return null
    
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const daysElapsed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const weeksElapsed = Math.ceil(daysElapsed / 7)
    const totalWeeks = cp.duration_weeks || Math.ceil(totalDays / 7)
    
    return {
      week: Math.min(weeksElapsed, totalWeeks),
      totalWeeks,
      percentage: Math.min(Math.round((daysElapsed / totalDays) * 100), 100),
      daysRemaining: Math.max(0, totalDays - daysElapsed)
    }
  }

  return (
    <div className="space-y-4">
      {clientPrograms.map((cp, idx) => {
        const prog = cp.program
        const cpProgress = getProgress(cp)
        const cpWorkouts = programWorkoutsMap[cp.program_id] || []
        const isExpanded = expandedPrograms.has(cp.id)
        
        return (
          <div key={cp.id} className="space-y-2">
            {/* Program Card - Clickable */}
            <button
              onClick={() => toggleProgram(cp.id)}
              className={`w-full text-left bg-zinc-900 border ${idx === 0 ? 'border-yellow-400/30' : 'border-zinc-800'} hover:border-yellow-400/50 rounded-2xl p-5 transition-all`}
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-yellow-400/10 rounded-xl flex items-center justify-center text-2xl shrink-0">
                  {prog?.category?.charAt(0).toUpperCase() || 'P'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-yellow-400 text-black text-xs font-bold rounded">
                      ACTIVE
                    </span>
                    {cpProgress && (
                      <span className="text-zinc-500 text-xs">
                        Week {cpProgress.week}/{cpProgress.totalWeeks}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-white text-lg">{prog?.name || 'Program'}</h3>
                  {cp.phase_name && (
                    <p className="text-yellow-400/80 text-sm">{cp.phase_name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-zinc-500 text-sm">{cpWorkouts.length} workouts</span>
                    {prog?.category && (
                      <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded capitalize">
                        {prog.category}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 mt-2">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-yellow-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-zinc-500" />
                  )}
                </div>
              </div>
              
              {/* Progress Bar */}
              {cpProgress && (
                <div className="mt-4">
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${cpProgress.percentage}%` }}
                    />
                  </div>
                </div>
              )}
            </button>

            {/* Workouts List - Expandable, Grouped by Day */}
            {isExpanded && cpWorkouts.length > 0 && (() => {
              // Group workouts by day
              const groupedByDay: { day: number | null; dayName: string; workouts: typeof cpWorkouts }[] = []
              const dayMap = new Map<number | null, typeof cpWorkouts>()
              
              cpWorkouts.forEach(w => {
                const existing = dayMap.get(w.day_of_week)
                if (existing) {
                  existing.push(w)
                } else {
                  dayMap.set(w.day_of_week, [w])
                }
              })

              // Sort: days first (0-6), then unassigned (null) at bottom
              const sortedDays = Array.from(dayMap.keys()).sort((a, b) => {
                if (a === null) return 1
                if (b === null) return -1
                return a - b
              })

              sortedDays.forEach(day => {
                groupedByDay.push({
                  day,
                  dayName: day === null ? 'Unassigned' : daysOfWeek[day],
                  workouts: dayMap.get(day) || []
                })
              })

              return (
                <div className="space-y-4 animate-fade-in">
                  {groupedByDay.map((group) => (
                    <div key={group.dayName} className="space-y-2">
                      {/* Day Header */}
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          group.day !== null ? 'bg-yellow-400/20' : 'bg-zinc-700'
                        }`}>
                          <span className={`font-bold text-sm ${
                            group.day !== null ? 'text-yellow-400' : 'text-zinc-400'
                          }`}>
                            {group.day !== null ? dayAbbrev[group.day] : '?'}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-medium">{group.dayName}</p>
                          <p className="text-zinc-500 text-xs">{group.workouts.length} workout{group.workouts.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>

                      {/* Workouts for this day */}
                      <div className="space-y-2 pl-4 border-l-2 border-yellow-400/30">
                        {group.workouts.map((workout) => (
                          <div key={workout.id} className="space-y-1">
                            {/* Main Workout */}
                            <Link
                              href={`/workout/${workout.id}?clientProgramId=${cp.id}`}
                              className="block bg-zinc-900/80 border border-zinc-800 hover:border-yellow-400/50 rounded-xl p-4 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-white font-medium">{workout.name}</p>
                                </div>
                                <span className="text-yellow-400">→</span>
                              </div>
                            </Link>
                            
                            {/* Finisher Sub-workout (nested) */}
                            {workout.finisher && (
                              <Link
                                href={`/workout/${workout.finisher.id}?clientProgramId=${cp.id}`}
                                className="block ml-4 bg-zinc-800/50 border border-zinc-700 hover:border-orange-400/50 rounded-lg p-3 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded bg-orange-500/20 flex items-center justify-center">
                                    <span className="text-orange-400 text-xs font-bold">F</span>
                                  </div>
                                  <p className="text-zinc-300 text-sm font-medium">{workout.finisher.name}</p>
                                  <span className="text-orange-400 ml-auto text-sm">→</span>
                                </div>
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )
      })}
    </div>
  )
}
