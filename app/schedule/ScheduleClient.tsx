'use client'

import { useEffect, useState } from 'react'
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

interface WorkoutLogDetails {
  id: string
  notes: string | null
  rating: number | null
  sets: {
    exercise_name: string
    set_number: number
    weight_kg: number | null
    reps_completed: number | null
  }[]
}

interface ScheduleClientProps {
  scheduleByDay: Record<number, WorkoutSchedule[]>
  completedWorkouts: Record<string, boolean>
  upcomingPrograms: UpcomingProgram[]
  programStartDate?: string  // Earliest active program start date
}

interface WorkoutPreview {
  name: string
  sets: { set_number: number; reps: string; intensity: string }[]
}

export default function ScheduleClient({ scheduleByDay, completedWorkouts, upcomingPrograms, programStartDate }: ScheduleClientProps) {
  const [mounted, setMounted] = useState(false)
  const [today, setToday] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [workoutDetails, setWorkoutDetails] = useState<WorkoutLogDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [viewingWorkoutId, setViewingWorkoutId] = useState<string | null>(null)
  const [workoutPreview, setWorkoutPreview] = useState<Record<string, WorkoutPreview[]>>({})
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const supabase = createClient()

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  
  // Convert JS getDay() (0=Sun) to Monday-first index (0=Mon)
  const toMondayFirstIndex = (jsDay: number) => (jsDay + 6) % 7

  useEffect(() => {
    setMounted(true)
    setToday(new Date())
    setCurrentMonth(new Date())
  }, [])

  // Fetch workout details for a completed workout
  const fetchWorkoutDetails = async (date: Date, workoutId: string, clientProgramId: string) => {
    setLoadingDetails(true)
    setViewingWorkoutId(workoutId)
    
    const dateStr = formatDateLocal(date)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // First check workout_completions for the workout_log_id
      // Try with client_program_id first, then without (for older records)
      let completion = null
      const { data: completionWithProgram } = await supabase
        .from('workout_completions')
        .select('workout_log_id')
        .eq('client_id', user.id)
        .eq('workout_id', workoutId)
        .eq('scheduled_date', dateStr)
        .eq('client_program_id', clientProgramId)
        .single()
      
      completion = completionWithProgram
      
      if (!completion) {
        // Fallback: try without client_program_id for older records
        const { data: completionAny } = await supabase
          .from('workout_completions')
          .select('workout_log_id')
          .eq('client_id', user.id)
          .eq('workout_id', workoutId)
          .eq('scheduled_date', dateStr)
          .order('completed_at', { ascending: false })
          .limit(1)
          .single()
        
        completion = completionAny
      }

      // Try to get workout log - either from completion link or direct query
      let workoutLogId = completion?.workout_log_id
      
      if (!workoutLogId) {
        // Fallback: direct query to workout_logs
        const { data: directLog } = await supabase
          .from('workout_logs')
          .select('id')
          .eq('client_id', user.id)
          .eq('workout_id', workoutId)
          .eq('scheduled_date', dateStr)
          .single()
        
        workoutLogId = directLog?.id
      }

      if (workoutLogId) {
        // Get full workout log details
        const { data: workoutLog } = await supabase
          .from('workout_logs')
          .select('id, notes, rating')
          .eq('id', workoutLogId)
          .single()

        // Get set logs with exercise names
        const { data: setLogs } = await supabase
          .from('set_logs')
          .select('set_number, weight_kg, reps_completed, exercise_id')
          .eq('workout_log_id', workoutLogId)
          .order('exercise_id')
          .order('set_number')

        // Get exercise names
        const exerciseIds = [...new Set(setLogs?.map(s => s.exercise_id) || [])]
        let exerciseMap = new Map<string, string>()
        
        if (exerciseIds.length > 0) {
          const { data: exercises } = await supabase
            .from('workout_exercises')
            .select('id, exercise_name')
            .in('id', exerciseIds)

          exerciseMap = new Map(exercises?.map(e => [e.id, e.exercise_name]) || [])
        }

        setWorkoutDetails({
          id: workoutLog?.id || workoutLogId,
          notes: workoutLog?.notes || null,
          rating: workoutLog?.rating || null,
          sets: (setLogs || []).map(s => ({
            exercise_name: exerciseMap.get(s.exercise_id) || 'Exercise',
            set_number: s.set_number,
            weight_kg: s.weight_kg,
            reps_completed: s.reps_completed
          }))
        })
      } else {
        setWorkoutDetails(null)
      }
    } catch (err) {
      console.error('Failed to fetch workout details:', err)
      setWorkoutDetails(null)
    } finally {
      setLoadingDetails(false)
    }
  }

  const closeDetails = () => {
    setWorkoutDetails(null)
    setViewingWorkoutId(null)
  }

  // Format date to YYYY-MM-DD in local timezone (not UTC)
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

  // Get status for a specific date (overall - for calendar view)
  const getDateStatus = (date: Date): 'completed' | 'partial' | 'skipped' | 'upcoming' | 'rest' => {
    const dateStr = formatDateLocal(date)
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
              const dayOfWeek = date.getDay() // 0=Sun for scheduleByDay lookup
              const dayIndex = toMondayFirstIndex(dayOfWeek) // 0=Mon for display
              const workouts = scheduleByDay[dayOfWeek] || []
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
                const workouts = scheduleByDay[date.getDay()] || []
                const hasWorkouts = workouts.length > 0
                
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => setSelectedDate(date)}
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

      {/* Day Detail Modal */}
      {selectedDate && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedDate(null)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {fullDayNames[toMondayFirstIndex(selectedDate.getDay())]}
                </h3>
                <p className="text-zinc-400 text-sm">
                  {selectedDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button 
                onClick={() => setSelectedDate(null)}
                className="p-2 text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {(() => {
                const workouts = scheduleByDay[selectedDate.getDay()] || []
                const status = getDateStatus(selectedDate)
                const isDateToday = selectedDate.toDateString() === today.toDateString()
                const isPast = selectedDate < today && !isDateToday
                
                if (workouts.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                      </div>
                      <h4 className="text-white font-semibold mb-1">Rest Day</h4>
                      <p className="text-zinc-500 text-sm">No workout scheduled. Recover well!</p>
                    </div>
                  )
                }
                
                return (
                  <div className="space-y-3">
                    {workouts.map((workout) => {
                      const workoutCompleted = isWorkoutCompleted(selectedDate, workout)
                      return (
                        <div 
                          key={workout.workoutId}
                          className={`p-4 rounded-xl border ${
                            workoutCompleted 
                              ? 'bg-green-500/10 border-green-500/30' 
                              : 'bg-zinc-800/50 border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`w-3 h-3 rounded-full ${getCategoryColor(workout.programCategory)}`} />
                            <h4 className={`font-semibold ${workoutCompleted ? 'text-green-400' : 'text-white'}`}>
                              {workout.workoutName}
                            </h4>
                            {workoutCompleted && (
                              <svg className="w-5 h-5 text-green-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <p className="text-zinc-400 text-sm mb-3">{workout.programName}</p>
                          
                          {/* Action button - only show for today or future dates with incomplete workouts */}
                          {(isDateToday || !isPast) && !workoutCompleted && (
                            <Link
                              href={`/workout/${workout.workoutId}?clientProgramId=${workout.clientProgramId}&scheduledDate=${formatDateLocal(selectedDate!)}`}
                              className="block w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-3 rounded-lg text-center transition-colors"
                              onClick={() => setSelectedDate(null)}
                            >
                              Start Workout →
                            </Link>
                          )}
                          
                          {workoutCompleted && (
                            <>
                              {viewingWorkoutId === workout.workoutId ? (
                                loadingDetails ? (
                                  <div className="text-center py-3">
                                    <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin mx-auto" />
                                  </div>
                                ) : workoutDetails ? (
                                  <div className="mt-3 pt-3 border-t border-zinc-700 space-y-2">
                                    {workoutDetails.notes && (
                                      <p className="text-sm text-zinc-400 italic">{workoutDetails.notes}</p>
                                    )}
                                    {(() => {
                                      const groups = workoutDetails.sets.reduce((acc, s) => {
                                        if (!acc[s.exercise_name]) acc[s.exercise_name] = []
                                        acc[s.exercise_name].push(s)
                                        return acc
                                      }, {} as Record<string, typeof workoutDetails.sets>)
                                      
                                      return Object.entries(groups).map(([name, sets]) => (
                                        <div key={name} className="bg-zinc-800/50 rounded-lg p-2">
                                          <p className="text-xs text-yellow-400 font-medium mb-1">{name}</p>
                                          {sets.map(s => (
                                            <div key={s.set_number} className="flex justify-between text-xs">
                                              <span className="text-zinc-500">Set {s.set_number}</span>
                                              <span className="text-white">{s.weight_kg ?? '—'}kg × {s.reps_completed ?? '—'}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ))
                                    })()}
                                    <button
                                      onClick={() => closeDetails()}
                                      className="text-zinc-500 text-xs w-full py-1"
                                    >
                                      Hide Details
                                    </button>
                                  </div>
                                ) : (
                                  <p className="text-zinc-500 text-sm text-center py-2">No data recorded</p>
                                )
                              ) : (
                                <button
                                  onClick={() => fetchWorkoutDetails(selectedDate!, workout.workoutId, workout.clientProgramId)}
                                  className="block w-full bg-green-500/20 hover:bg-green-500/30 text-green-400 font-medium py-2 rounded-lg text-center text-sm transition-colors"
                                >
                                  View Details
                                </button>
                              )}
                            </>
                          )}
                          
                          {isPast && !workoutCompleted && (
                            <div className="text-red-400 text-sm font-medium text-center py-2">
                              Missed
                            </div>
                          )}
                        </div>
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
