'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface WorkoutSchedule {
  dayOfWeek: number
  workoutId: string
  workoutName: string
  programName: string
  clientProgramId: string
}

interface ScheduleClientProps {
  scheduleByDay: Record<number, WorkoutSchedule>
  completionsByDate: Record<string, string>
}

export default function ScheduleClient({ scheduleByDay, completionsByDate }: ScheduleClientProps) {
  const [mounted, setMounted] = useState(false)
  const [today, setToday] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  useEffect(() => {
    setMounted(true)
    setToday(new Date())
    setCurrentMonth(new Date())
  }, [])

  // Format date to YYYY-MM-DD in local timezone (not UTC)
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Get status for a specific date
  const getDateStatus = (date: Date): 'completed' | 'skipped' | 'upcoming' | 'rest' => {
    const dateStr = formatDateLocal(date)
    const dayOfWeek = date.getDay()
    const hasWorkout = scheduleByDay[dayOfWeek]
    
    if (!hasWorkout) return 'rest'
    
    const todayStart = new Date(today)
    todayStart.setHours(0, 0, 0, 0)
    const dateStart = new Date(date)
    dateStart.setHours(0, 0, 0, 0)
    
    if (completionsByDate[dateStr]) {
      return 'completed'
    }
    
    if (dateStart < todayStart) {
      return 'skipped'
    }
    
    return 'upcoming'
  }

  // Get week dates starting from current week's Sunday
  const getWeekDates = () => {
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())
    
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  // Get calendar days for current month
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    const days: (Date | null)[] = []
    
    // Add empty slots for days before first of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null)
    }
    
    // Add all days in month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d))
    }
    
    return days
  }

  const weekDates = getWeekDates()
  const calendarDays = getCalendarDays()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 border-green-500/50 text-green-400'
      case 'skipped': return 'bg-red-500/20 border-red-500/50 text-red-400'
      case 'upcoming': return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
      default: return 'bg-zinc-800/50 border-zinc-700 text-zinc-500'
    }
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'skipped': return 'bg-red-500'
      case 'upcoming': return 'bg-yellow-500'
      default: return 'bg-zinc-700'
    }
  }

  if (!mounted) {
    return <div className="px-6 py-6"><div className="h-64 bg-zinc-800 rounded-2xl animate-pulse" /></div>
  }

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 bg-black/95 backdrop-blur-lg border-b border-zinc-800 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-widest">SCHEDULE</h1>
            <div className="w-8 h-1 bg-yellow-400"></div>
          </div>
          <p className="text-zinc-500 text-sm mt-1">Your training week at a glance</p>
        </div>
      </header>

      <main className="px-6 py-6 space-y-8">
        {/* Weekly Schedule */}
        <section>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">This Week</h2>
          <div className="space-y-3">
            {weekDates.map((date, idx) => {
              const isToday = date.toDateString() === today.toDateString()
              const dayOfWeek = date.getDay()
              const workout = scheduleByDay[dayOfWeek]
              const status = getDateStatus(date)
              
              return (
                <div 
                  key={idx}
                  className={`rounded-xl border p-4 transition-all ${
                    workout
                      ? status === 'completed' 
                        ? 'bg-green-500/5 border-green-500/20'
                        : status === 'skipped'
                          ? 'bg-red-500/5 border-red-500/20'
                          : 'bg-yellow-500/5 border-yellow-500/20'
                      : 'bg-zinc-900 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Today indicator - white dot */}
                      {isToday && (
                        <div className="w-3 h-3 rounded-full bg-white" />
                      )}
                      {/* Status indicator for non-today workout days */}
                      {workout && !isToday && (
                        <div className={`w-3 h-3 rounded-full ${getStatusDot(status)}`} />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-white`}>
                            {fullDayNames[dayOfWeek]}
                          </span>
                          {isToday && (
                            <span className="px-2 py-0.5 bg-white text-black text-xs font-bold rounded-full">
                              TODAY
                            </span>
                          )}
                        </div>
                        <span className="text-zinc-500 text-sm">
                          {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    
                    {workout ? (
                      <div className="text-right">
                        <p className="text-white font-medium">{workout.workoutName}</p>
                        <p className="text-zinc-500 text-sm">{workout.programName}</p>
                        {status === 'completed' && (
                          <span className="text-green-400 text-xs">Completed</span>
                        )}
                        {status === 'skipped' && (
                          <span className="text-red-400 text-xs">Missed</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-600 text-sm">Rest day</span>
                    )}
                  </div>
                  
                  {/* Start workout button for today */}
                  {isToday && workout && status === 'upcoming' && (
                    <Link
                      href={`/workout/${workout.workoutId}?clientProgramId=${workout.clientProgramId}`}
                      className="mt-3 block w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 rounded-lg text-center transition-colors"
                    >
                      Start Workout →
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Monthly Calendar */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
              {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Calendar grid */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {daysOfWeek.map(day => (
                <div key={day} className="text-center text-zinc-500 text-xs font-medium py-2">
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
                const hasWorkout = scheduleByDay[date.getDay()]
                
                return (
                  <div
                    key={date.toISOString()}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all ${
                      hasWorkout
                        ? getStatusColor(status)
                        : 'text-zinc-600'
                    } ${hasWorkout ? 'border' : ''} ${isToday ? 'font-bold' : ''}`}
                  >
                    <span className={isToday && !hasWorkout ? 'text-white' : ''}>{date.getDate()}</span>
                    {/* Today indicator dot - only on today's date */}
                    {isToday && (
                      <div className="w-1.5 h-1.5 rounded-full mt-0.5 bg-white" />
                    )}
                  </div>
                )
              })}
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-zinc-800">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-zinc-400 text-xs">Complete</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-zinc-400 text-xs">Missed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="text-zinc-400 text-xs">Upcoming</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white" />
                <span className="text-zinc-400 text-xs">Today</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
