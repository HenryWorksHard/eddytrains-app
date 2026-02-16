'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../lib/supabase/client'
import { SlideOutMenu, HamburgerButton } from '../components/SlideOutMenu'

interface WorkoutSchedule {
  dayOfWeek: number
  workoutId: string
  workoutName: string
  programName: string
  programCategory: string
  clientProgramId: string
  weekNumber?: number
}

interface UpcomingProgram {
  id: string
  programId: string
  programName: string
  programCategory: string
  startDate: string
  endDate: string | null
  phaseName: string | null
}

interface ScheduleClientProps {
  scheduleByDay: Record<number, WorkoutSchedule[]>
  scheduleByWeekAndDay?: Record<number, Record<number, WorkoutSchedule[]>>
  completedWorkouts: Record<string, boolean>
  upcomingPrograms: UpcomingProgram[]
  programStartDate?: string
  maxWeek?: number
}

export default function ScheduleClient({ scheduleByDay, scheduleByWeekAndDay, completedWorkouts, upcomingPrograms, programStartDate, maxWeek = 1 }: ScheduleClientProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [today, setToday] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [menuOpen, setMenuOpen] = useState(false)
  const supabase = createClient()
  
  // Navigate to log page with selected date
  const goToLogDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    router.push(`/log?date=${year}-${month}-${day}`)
  }

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  
  // Convert JS getDay() (0=Sun) to Monday-first index (0=Mon)
  const toMondayFirstIndex = (jsDay: number) => (jsDay + 6) % 7

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

  // Calculate which week a date falls into based on program start date
  const getWeekForDate = (date: Date): number => {
    if (!programStartDate) return 1
    
    const startDate = new Date(programStartDate)
    startDate.setHours(0, 0, 0, 0)
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    
    const daysSinceStart = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysSinceStart < 0) return 1 // Before program start, show week 1
    
    const weekNum = Math.floor(daysSinceStart / 7) + 1
    return Math.min(weekNum, maxWeek) // Cap at max week
  }

  // Get workouts for a specific date (considering week number)
  const getWorkoutsForDate = (date: Date): WorkoutSchedule[] => {
    const weekNum = getWeekForDate(date)
    const dayOfWeek = date.getDay()
    
    // Return workouts for specific week+day
    // Do NOT fallback to other weeks - if no workouts, it's a rest day
    if (scheduleByWeekAndDay?.[weekNum]?.[dayOfWeek] !== undefined) {
      return scheduleByWeekAndDay[weekNum][dayOfWeek]
    }
    
    // Only use legacy scheduleByDay if no week data exists at all
    if (!scheduleByWeekAndDay || Object.keys(scheduleByWeekAndDay).length === 0) {
      return scheduleByDay[dayOfWeek] || []
    }
    
    // No workouts for this week+day = rest day
    return []
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

  // Get status for a specific date (overall - for calendar view)
  const getDateStatus = (date: Date): 'completed' | 'partial' | 'skipped' | 'upcoming' | 'rest' => {
    const dateStr = formatDateLocal(date)
    const workouts = getWorkoutsForDate(date)
    
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
    
    // Check how many workouts are completed for this date
    const completedCount = workouts.filter(w => isWorkoutCompleted(date, w)).length
    
    if (completedCount === workouts.length) {
      return 'completed'
    }
    
    if (completedCount > 0) {
      return 'partial'
    }
    
    if (dateStart < todayStart) {
      return 'skipped'
    }
    
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

  // Get week dates starting from current week's Monday
  const getWeekDates = () => {
    const startOfWeek = new Date(today)
    const dayOfWeek = today.getDay()
    // Adjust to Monday: if Sunday (0), go back 6 days; otherwise go back (day - 1) days
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    startOfWeek.setDate(today.getDate() - daysToMonday)
    
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
    
    // Add empty slots for days before first of month (Monday-first)
    const firstDayMondayIndex = toMondayFirstIndex(firstDay.getDay())
    for (let i = 0; i < firstDayMondayIndex; i++) {
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
      case 'partial': return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
      case 'skipped': return 'bg-red-500/20 border-red-500/50 text-red-400'
      case 'upcoming': return 'bg-white/10 border-white/30 text-white'
      case 'rest': return 'bg-zinc-800/30 border-zinc-700/50 text-zinc-500'
      default: return 'bg-zinc-800/50 border-zinc-700 text-zinc-500'
    }
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'skipped': return 'bg-red-500'
      case 'upcoming': return 'bg-white'
      default: return 'bg-zinc-700'
    }
  }

  if (!mounted) {
    return <div className="px-6 py-6"><div className="h-64 bg-zinc-800 rounded-2xl animate-pulse" /></div>
  }

  return (
    <>
      {/* Slide Out Menu */}
      <SlideOutMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      
      {/* Header */}
      <header className="sticky top-0 bg-black/95 backdrop-blur-lg border-b border-zinc-800 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <HamburgerButton onClick={() => setMenuOpen(true)} />
          <h1 className="text-lg font-semibold text-white">Schedule</h1>
          <div className="w-10" />
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
              const dayIndex = toMondayFirstIndex(dayOfWeek) // 0=Mon for display
              const workouts = getWorkoutsForDate(date)
              const hasWorkouts = workouts.length > 0
              const status = getDateStatus(date)
              
              return (
                <div 
                  key={idx}
                  className={`rounded-xl border p-4 transition-all ${
                    hasWorkouts
                      ? status === 'completed' 
                        ? 'bg-green-500/5 border-green-500/20'
                        : status === 'skipped'
                          ? 'bg-red-500/5 border-red-500/20'
                          : status === 'partial'
                            ? 'bg-yellow-500/5 border-yellow-500/20'
                            : 'bg-zinc-800/50 border-zinc-700'
                      : 'bg-zinc-900 border-zinc-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Today indicator - yellow dot (visible on both themes) */}
                      {isToday && (
                        <div className="w-3 h-3 rounded-full bg-yellow-400 mt-1" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-white`}>
                            {fullDayNames[dayIndex]}
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
                    
                    {hasWorkouts ? (
                      <div className="text-right space-y-2">
                        {workouts.map((workout, wIdx) => {
                          const workoutCompleted = isWorkoutCompleted(date, workout)
                          return (
                            <div key={workout.workoutId} className={wIdx > 0 ? 'pt-2 border-t border-zinc-700/50' : ''}>
                              <div className="flex items-center justify-end gap-2">
                                {workoutCompleted && (
                                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                                <div className={`w-2 h-2 rounded-full ${getCategoryColor(workout.programCategory)}`} />
                                <p className={`font-medium ${workoutCompleted ? 'text-green-400' : 'text-white'}`}>{workout.workoutName}</p>
                              </div>
                              <p className="text-zinc-500 text-sm">{workout.programName}</p>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="text-zinc-600 text-sm">Rest day</span>
                    )}
                  </div>
                  
                  {/* Start workout buttons for today - only show incomplete workouts */}
                  {isToday && hasWorkouts && (
                    <div className="mt-3 space-y-2">
                      {workouts.map((workout) => {
                        const workoutCompleted = isWorkoutCompleted(date, workout)
                        if (workoutCompleted) {
                          return (
                            <div 
                              key={workout.workoutId}
                              className="flex items-center justify-between bg-green-500/10 border border-green-500/30 text-green-400 py-3 px-4 rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>{workout.workoutName}</span>
                              </div>
                              <span className="text-sm">Done</span>
                            </div>
                          )
                        }
                        return (
                          <Link
                            key={workout.workoutId}
                            href={`/workout/${workout.workoutId}?clientProgramId=${workout.clientProgramId}&scheduledDate=${formatDateLocal(date)}`}
                            className="flex items-center justify-between bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-4 rounded-lg transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${getCategoryColor(workout.programCategory)}`} />
                              <span>{workout.workoutName}</span>
                            </div>
                            <span>→</span>
                          </Link>
                        )
                      })}
                    </div>
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
                const workouts = getWorkoutsForDate(date)
                const hasWorkouts = workouts.length > 0
                
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => goToLogDate(date)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                      hasWorkouts
                        ? getStatusColor(status)
                        : 'bg-zinc-800/30 text-zinc-500 hover:bg-zinc-700/50'
                    } ${hasWorkouts ? 'border' : 'border border-zinc-800/50'} ${isToday ? 'font-bold ring-2 ring-yellow-400' : ''}`}
                  >
                    <span className={isToday ? 'text-yellow-400' : ''}>{date.getDate()}</span>
                    {/* Workout category indicator dots */}
                    {hasWorkouts && (
                      <div className="flex gap-0.5 mt-0.5">
                        {workouts.slice(0, 3).map((w, i) => (
                          <div key={i} className={`w-1 h-1 rounded-full ${getCategoryColor(w.programCategory)}`} />
                        ))}
                      </div>
                    )}
                    {/* Rest day indicator */}
                    {!hasWorkouts && !isToday && (
                      <span className="text-[8px] text-zinc-600 mt-0.5">REST</span>
                    )}
                  </button>
                )
              })}
            </div>
            
            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4 pt-4 border-t border-zinc-800">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-zinc-400 text-xs">Complete</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-zinc-400 text-xs">Missed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded bg-zinc-700" />
                <span className="text-zinc-400 text-xs">Rest</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 ring-1 ring-yellow-400" />
                <span className="text-zinc-400 text-xs">Today</span>
              </div>
            </div>
          </div>
        </section>

        {/* Upcoming Programs */}
        {upcomingPrograms.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Upcoming Programs</h2>
            <div className="space-y-3">
              {upcomingPrograms.map((program) => (
                <div 
                  key={program.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                      program.programCategory === 'strength' ? 'bg-blue-500/20 text-blue-400' :
                      program.programCategory === 'cardio' ? 'bg-green-500/20 text-green-400' :
                      program.programCategory === 'hyrox' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-purple-500/20 text-purple-400'
                    }`}>
                      {program.programCategory === 'strength' ? 'S' :
                       program.programCategory === 'cardio' ? 'C' :
                       program.programCategory === 'hyrox' ? 'H' : 'HY'}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{program.programName}</p>
                      {program.phaseName && (
                        <p className="text-zinc-500 text-sm">{program.phaseName}</p>
                      )}
                      <p className="text-zinc-600 text-xs mt-1">
                        Starts {new Date(program.startDate).toLocaleDateString('en-AU', { 
                          weekday: 'short', day: 'numeric', month: 'short' 
                        })}
                        {program.endDate && ` — Ends ${new Date(program.endDate).toLocaleDateString('en-AU', { 
                          day: 'numeric', month: 'short' 
                        })}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

    </>
  )
}
