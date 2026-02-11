'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface WorkoutSchedule {
  dayOfWeek: number
  workoutId: string
  workoutName: string
  programName: string
  programCategory: string
  clientProgramId: string
}

interface WorkoutCalendarProps {
  scheduleByDay: Record<number, WorkoutSchedule[]>
  completedWorkouts: Record<string, boolean>
  compact?: boolean // For home screen - smaller version
  programStartDate?: string // Earliest active program start date
}

export default function WorkoutCalendar({ scheduleByDay, completedWorkouts, compact = false, programStartDate }: WorkoutCalendarProps) {
  const [mounted, setMounted] = useState(false)
  const [today, setToday] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  
  // Convert JS getDay() (0=Sun) to Monday-first index (0=Mon)
  const toMondayFirstIndex = (jsDay: number) => (jsDay + 6) % 7

  useEffect(() => {
    setMounted(true)
    setToday(new Date())
    setCurrentMonth(new Date())
  }, [])

  // Format date to YYYY-MM-DD in local timezone
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Check if a specific workout is completed for a date
  const isWorkoutCompleted = (date: Date, workout: WorkoutSchedule): boolean => {
    const dateStr = formatDateLocal(date)
    // Check multiple key formats for compatibility:
    // 1. Exact match with program ID
    // 2. Match without program ID (old completions)
    // 3. Any completion on that date (handles program changes with different workout IDs)
    const keyWithProgram = `${dateStr}:${workout.workoutId}:${workout.clientProgramId}`
    const keyWithoutProgram = `${dateStr}:${workout.workoutId}`
    const keyDateOnly = `${dateStr}:any`
    return completedWorkouts[keyWithProgram] === true || 
           completedWorkouts[keyWithoutProgram] === true ||
           completedWorkouts[keyDateOnly] === true
  }

  // Get status for a specific date
  const getDateStatus = (date: Date): 'completed' | 'partial' | 'skipped' | 'upcoming' | 'rest' => {
    const dayOfWeek = date.getDay()
    const workouts = scheduleByDay[dayOfWeek] || []
    
    if (workouts.length === 0) return 'rest'
    
    const todayStart = new Date(today)
    todayStart.setHours(0, 0, 0, 0)
    const dateStart = new Date(date)
    dateStart.setHours(0, 0, 0, 0)
    
    // If date is before program started, treat as rest (not skipped)
    if (programStartDate) {
      const programStart = new Date(programStartDate + 'T00:00:00')
      if (dateStart < programStart) {
        return 'rest'
      }
    }
    
    const completedCount = workouts.filter(w => isWorkoutCompleted(date, w)).length
    
    if (completedCount === workouts.length) return 'completed'
    if (completedCount > 0) return 'partial'
    if (dateStart < todayStart) return 'skipped'
    return 'upcoming'
  }

  // Get category color
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'strength': return 'bg-blue-500'
      case 'cardio': return 'bg-green-500'
      case 'hyrox': return 'bg-orange-500'
      case 'hybrid': return 'bg-purple-500'
      default: return 'bg-yellow-500'
    }
  }

  // Get calendar days for current month
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    const days: (Date | null)[] = []
    
    const firstDayMondayIndex = toMondayFirstIndex(firstDay.getDay())
    for (let i = 0; i < firstDayMondayIndex; i++) {
      days.push(null)
    }
    
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d))
    }
    
    return days
  }

  const calendarDays = getCalendarDays()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 border-green-500/50 text-green-400'
      case 'partial': return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
      case 'skipped': return 'bg-red-500/20 border-red-500/50 text-red-400'
      case 'upcoming': return 'bg-white/10 border-white/30 text-white'
      case 'rest': return 'bg-zinc-800/30 border-zinc-700/50 text-zinc-500'
      default: return 'bg-zinc-800/50 border-zinc-700 text-zinc-500'
    }
  }

  if (!mounted) {
    return <div className={`${compact ? 'h-48' : 'h-64'} bg-zinc-800 rounded-2xl animate-pulse`} />
  }

  return (
    <>
      {/* Calendar Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3">
        {/* Month Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className={`font-semibold text-white ${compact ? 'text-sm' : 'text-base'}`}>
            {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {daysOfWeek.map(day => (
            <div key={day} className={`text-center text-zinc-500 font-medium py-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} className="aspect-square" />
            }
            
            const isToday = date.toDateString() === today.toDateString()
            const status = getDateStatus(date)
            const workouts = scheduleByDay[date.getDay()] || []
            const hasWorkouts = workouts.length > 0
            
            // Get the first workout for navigation (if any)
            const firstWorkout = workouts[0]
            
            const dayContent = (
              <div
                className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all ${
                  hasWorkouts
                    ? `${getStatusColor(status)} border cursor-pointer hover:scale-105 active:scale-95`
                    : 'bg-zinc-800/30 text-zinc-600 border border-zinc-800/50'
                } ${isToday ? 'ring-2 ring-yellow-400' : ''}`}
              >
                <span className={`${compact ? 'text-xs' : 'text-sm'} ${isToday ? 'text-yellow-400 font-bold' : ''}`}>
                  {date.getDate()}
                </span>
                {/* Workout indicator dot */}
                {hasWorkouts && (
                  <div className="flex gap-0.5 mt-0.5">
                    {workouts.slice(0, 3).map((w, i) => (
                      <div key={i} className={`${compact ? 'w-1 h-1' : 'w-1.5 h-1.5'} rounded-full ${getCategoryColor(w.programCategory)}`} />
                    ))}
                  </div>
                )}
              </div>
            )
            
            // If has workouts, make it clickable
            if (hasWorkouts) {
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className="focus:outline-none"
                >
                  {dayContent}
                </button>
              )
            }
            
            return <div key={date.toISOString()}>{dayContent}</div>
          })}
        </div>
        
        {/* Legend */}
        <div className={`flex flex-wrap items-center justify-center gap-2 mt-3 pt-3 border-t border-zinc-800 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          <div className="flex items-center gap-1">
            <div className={`${compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded-full bg-green-500`} />
            <span className="text-zinc-400">Complete</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`${compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded-full bg-red-500`} />
            <span className="text-zinc-400">Missed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`${compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded bg-zinc-700`} />
            <span className="text-zinc-400">Rest</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`${compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded-full ring-1 ring-yellow-400 bg-yellow-400`} />
            <span className="text-zinc-400">Today</span>
          </div>
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDate && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedDate(null)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xs overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">
                  {fullDayNames[toMondayFirstIndex(selectedDate.getDay())]}
                </h3>
                <p className="text-zinc-400 text-xs">
                  {selectedDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button 
                onClick={() => setSelectedDate(null)}
                className="p-1.5 text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-3 overflow-y-auto max-h-[50vh]">
              {(() => {
                const workouts = scheduleByDay[selectedDate.getDay()] || []
                const isDateToday = selectedDate.toDateString() === today.toDateString()
                const isPast = selectedDate < today && !isDateToday
                
                if (workouts.length === 0) {
                  return (
                    <div className="text-center py-4">
                      <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-2">
                        <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                      </div>
                      <h4 className="text-white font-medium text-sm mb-0.5">Rest Day</h4>
                      <p className="text-zinc-500 text-xs">No workout scheduled</p>
                    </div>
                  )
                }
                
                return (
                  <div className="space-y-2">
                    {workouts.map((workout) => {
                      const workoutCompleted = isWorkoutCompleted(selectedDate, workout)
                      return (
                        <Link
                          key={workout.workoutId}
                          href={`/workout/${workout.workoutId}?clientProgramId=${workout.clientProgramId}`}
                          onClick={() => setSelectedDate(null)}
                          className={`block p-3 rounded-xl border transition-all active:scale-98 ${
                            workoutCompleted 
                              ? 'bg-green-500/10 border-green-500/30' 
                              : isPast 
                                ? 'bg-red-500/5 border-red-500/20'
                                : 'bg-zinc-800/50 border-zinc-700 hover:border-yellow-400/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${getCategoryColor(workout.programCategory)}`} />
                            <h4 className={`font-medium text-sm flex-1 ${
                              workoutCompleted ? 'text-green-400' : 
                              isPast ? 'text-red-400' : 'text-white'
                            }`}>
                              {workout.workoutName}
                            </h4>
                            {workoutCompleted ? (
                              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            )}
                          </div>
                          <p className="text-zinc-400 text-xs">{workout.programName}</p>
                          
                          {workoutCompleted && (
                            <div className="text-green-400 text-xs font-medium mt-1">
                              ✓ Completed
                            </div>
                          )}
                          
                          {isPast && !workoutCompleted && (
                            <div className="text-red-400 text-xs font-medium mt-1">
                              Missed
                            </div>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
