'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../lib/supabase/client'

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
  scheduleByWeekAndDay?: Record<number, Record<number, WorkoutSchedule[]>> // Week-specific schedules
  completedWorkouts: Record<string, boolean>
  compact?: boolean // For home screen - smaller version
  programStartDate?: string // Earliest active program start date
  maxWeek?: number // Maximum week number in the program
}

interface WorkoutLogDetail {
  id: string
  exerciseName: string
  sets: { setNumber: number; weight: number; reps: number }[]
}

export default function WorkoutCalendar({ scheduleByDay, scheduleByWeekAndDay, completedWorkouts, compact = false, programStartDate, maxWeek = 1 }: WorkoutCalendarProps) {
  const [mounted, setMounted] = useState(false)
  const [today, setToday] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [workoutDetails, setWorkoutDetails] = useState<WorkoutLogDetail[] | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showingDetailsFor, setShowingDetailsFor] = useState<string | null>(null)
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

  // Format date to YYYY-MM-DD in local timezone
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Calculate which week number a date falls into based on program start
  const getWeekNumberForDate = (date: Date): number => {
    if (!programStartDate) return 1
    
    const programStart = new Date(programStartDate + 'T00:00:00')
    const dateStart = new Date(date)
    dateStart.setHours(0, 0, 0, 0)
    
    // If date is before program start, return week 1
    if (dateStart < programStart) return 1
    
    // Calculate days since program start
    const diffTime = dateStart.getTime() - programStart.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    // Week number (1-indexed, cycling through maxWeek)
    const weekNum = Math.floor(diffDays / 7) + 1
    
    // Cycle through weeks if program repeats
    if (maxWeek > 0) {
      return ((weekNum - 1) % maxWeek) + 1
    }
    return weekNum
  }

  // Get workouts for a specific date (using week-specific schedule if available)
  const getWorkoutsForDate = (date: Date): WorkoutSchedule[] => {
    const dayOfWeek = date.getDay() // JS day (0=Sun)
    const weekNum = getWeekNumberForDate(date)
    
    // Try week-specific schedule first
    if (scheduleByWeekAndDay?.[weekNum]?.[dayOfWeek] !== undefined) {
      return scheduleByWeekAndDay[weekNum][dayOfWeek]
    }
    
    // If no week-specific data exists at all, fallback to legacy scheduleByDay
    if (!scheduleByWeekAndDay || Object.keys(scheduleByWeekAndDay).length === 0) {
      return scheduleByDay[dayOfWeek] || []
    }
    
    // Week-specific data exists but no workouts for this week+day = rest day
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

  // Get status for a specific date
  const getDateStatus = (date: Date): 'completed' | 'partial' | 'skipped' | 'upcoming' | 'rest' => {
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

  // Fetch workout log details for a completed workout
  const fetchWorkoutDetails = async (date: Date, workoutId: string) => {
    setLoadingDetails(true)
    setShowingDetailsFor(workoutId)
    setWorkoutDetails(null)
    
    try {
      const dateStr = formatDateLocal(date)
      
      // Get current user for filtering
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user found for fetching workout details')
        setWorkoutDetails([])
        setLoadingDetails(false)
        return
      }
      
      // Get workout log for this date - filter by client_id for RLS
      const { data: workoutLogs, error: logError } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('client_id', user.id)
        .eq('workout_id', workoutId)
        .eq('scheduled_date', dateStr)
        .order('completed_at', { ascending: false })
        .limit(1)
      
      if (logError) {
        console.error('Error fetching workout log:', logError)
      }
      
      if (workoutLogs && workoutLogs.length > 0) {
        await fetchSetLogs(workoutLogs[0].id)
        setLoadingDetails(false)
        return
      }
      
      // Fallback: Try with completed_at date range
      const { data: fallbackLogs, error: fallbackError } = await supabase
        .from('workout_logs')
        .select('id, completed_at')
        .eq('client_id', user.id)
        .eq('workout_id', workoutId)
        .gte('completed_at', `${dateStr}T00:00:00`)
        .lte('completed_at', `${dateStr}T23:59:59`)
        .order('completed_at', { ascending: false })
        .limit(1)
      
      if (fallbackError) {
        console.error('Error fetching fallback workout log:', fallbackError)
      }
      
      if (fallbackLogs && fallbackLogs.length > 0) {
        await fetchSetLogs(fallbackLogs[0].id)
        setLoadingDetails(false)
        return
      }
      
      // No logs found
      setWorkoutDetails([])
    } catch (err) {
      console.error('Failed to fetch workout details:', err)
      setWorkoutDetails([])
    }
    
    setLoadingDetails(false)
  }

  const fetchSetLogs = async (workoutLogId: string) => {
    const { data: setLogs, error: setLogsError } = await supabase
      .from('set_logs')
      .select(`
        exercise_id,
        set_number,
        weight_kg,
        reps_completed,
        swapped_exercise_name
      `)
      .eq('workout_log_id', workoutLogId)
      .order('exercise_id')
      .order('set_number')
    
    if (setLogsError) {
      console.error('Error fetching set logs:', setLogsError)
      setWorkoutDetails([])
      return
    }
    
    if (!setLogs || setLogs.length === 0) {
      setWorkoutDetails([])
      return
    }
    
    // Get exercise names from workout_exercises table
    const exerciseIds = [...new Set(setLogs.map(l => l.exercise_id))]
    const { data: exercises } = await supabase
      .from('workout_exercises')
      .select('id, exercise_name')
      .in('id', exerciseIds)
    
    const exerciseNameMap = new Map(exercises?.map(e => [e.id, e.exercise_name]) || [])
    
    // Group by exercise
    const exerciseMap = new Map<string, WorkoutLogDetail>()
    
    setLogs.forEach(log => {
      // Prefer swapped name, then lookup from workout_exercises
      const exerciseName = log.swapped_exercise_name || exerciseNameMap.get(log.exercise_id) || 'Unknown Exercise'
      const exerciseId = log.exercise_id
      
      if (!exerciseMap.has(exerciseId)) {
        exerciseMap.set(exerciseId, {
          id: exerciseId,
          exerciseName,
          sets: []
        })
      }
      
      exerciseMap.get(exerciseId)!.sets.push({
        setNumber: log.set_number,
        weight: log.weight_kg || 0,
        reps: log.reps_completed || 0
      })
    })
    
    setWorkoutDetails(Array.from(exerciseMap.values()))
  }

  const closeDetails = () => {
    setShowingDetailsFor(null)
    setWorkoutDetails(null)
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
            const workouts = getWorkoutsForDate(date)
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
                const workouts = getWorkoutsForDate(selectedDate)
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
                      const isShowingDetails = showingDetailsFor === workout.workoutId
                      
                      return (
                        <div
                          key={workout.workoutId}
                          className={`p-3 rounded-xl border transition-all ${
                            workoutCompleted 
                              ? 'bg-green-500/10 border-green-500/30' 
                              : isPast 
                                ? 'bg-red-500/5 border-red-500/20'
                                : 'bg-zinc-800/50 border-zinc-700'
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
                            {workoutCompleted && (
                              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
                          
                          {/* Action Buttons */}
                          <div className="flex gap-2 mt-3">
                            {/* View/Start Workout button */}
                            <Link
                              href={`/workout/${workout.workoutId}?clientProgramId=${workout.clientProgramId}${isPast ? `&scheduledDate=${formatDateLocal(selectedDate)}` : ''}`}
                              onClick={() => {
                                if (!workout.workoutId) {
                                  console.error('Missing workoutId:', workout)
                                  alert('Debug: workoutId is missing. Check console.')
                                }
                                setSelectedDate(null)
                              }}
                              className="flex-1 text-center py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              {workoutCompleted ? 'View Workout' : isPast ? 'View Workout' : 'Start Workout'}
                            </Link>
                            
                            {/* Log Workout button for missed days */}
                            {isPast && !workoutCompleted && (
                              <Link
                                href={`/log?date=${formatDateLocal(selectedDate)}&workoutId=${workout.workoutId}&clientProgramId=${workout.clientProgramId}`}
                                onClick={() => setSelectedDate(null)}
                                className="flex-1 text-center py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium rounded-lg transition-colors"
                              >
                                Log Workout
                              </Link>
                            )}
                            
                            {/* View Log button for completed */}
                            {workoutCompleted && (
                              <button
                                onClick={() => isShowingDetails ? closeDetails() : fetchWorkoutDetails(selectedDate, workout.workoutId)}
                                className="flex-1 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-medium rounded-lg transition-colors"
                              >
                                {loadingDetails && isShowingDetails ? 'Loading...' : isShowingDetails ? 'Hide Details' : 'View Log'}
                              </button>
                            )}
                          </div>
                          
                          {/* Workout Details */}
                          {isShowingDetails && workoutDetails && (
                            <div className="mt-3 pt-3 border-t border-zinc-700 space-y-3">
                              {workoutDetails.length === 0 ? (
                                <p className="text-zinc-500 text-xs text-center">No sets logged</p>
                              ) : (
                                workoutDetails.map((exercise) => (
                                  <div key={exercise.id}>
                                    <p className="text-white text-xs font-medium mb-1">{exercise.exerciseName}</p>
                                    <div className="space-y-1">
                                      {exercise.sets.map((set) => (
                                        <div key={set.setNumber} className="flex items-center gap-2 text-xs">
                                          <span className="w-5 h-5 bg-zinc-800 rounded flex items-center justify-center text-zinc-400">
                                            {set.setNumber}
                                          </span>
                                          <span className="text-white">{set.weight}kg</span>
                                          <span className="text-zinc-500">×</span>
                                          <span className="text-white">{set.reps} reps</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))
                              )}
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
