'use client'

import { useEffect, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Loader2, Play, X, Dumbbell } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface WorkoutSchedule {
  dayOfWeek: number
  workoutId: string
  workoutName: string
  programName: string
  clientProgramId: string
  weekNumber: number
}

interface WorkoutLogDetails {
  id: string | null
  workout_name: string
  completed_at: string | null
  notes: string | null
  rating: number | null
  trainer_name: string | null
  sets: {
    exercise_id?: string
    exercise_name: string
    set_number: number
    weight_kg: number | null
    reps_completed: number | null
    target_reps?: string
  }[]
  scheduled?: boolean
  workoutId?: string
  programName?: string
  preview?: {
    name: string
    sets: { set_number: number; reps: string; intensity: string }[]
  }[]
}

interface UserScheduleProps {
  userId: string
}

export default function UserSchedule({ userId }: UserScheduleProps) {
  const [loading, setLoading] = useState(true)
  const [scheduleByDay, setScheduleByDay] = useState<Record<number, WorkoutSchedule>>({})
  const [scheduleByWeekAndDay, setScheduleByWeekAndDay] = useState<Record<number, Record<number, WorkoutSchedule[]>>>({})
  const [completionsByDate, setCompletionsByDate] = useState<Record<string, string>>({})
  const [completionsByDateAndWorkout, setCompletionsByDateAndWorkout] = useState<Record<string, boolean>>({})
  const [programStartDate, setProgramStartDate] = useState<string | null>(null)
  const [maxWeek, setMaxWeek] = useState(1)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [workoutDetails, setWorkoutDetails] = useState<WorkoutLogDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedSets, setEditedSets] = useState<Map<string, { weight_kg: number | null; reps_completed: number | null }>>(new Map())
  const [savingEdits, setSavingEdits] = useState(false)
  const supabase = createClient()
  const today = new Date()
  
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  
  // Convert JS getDay() (0=Sun) to Monday-first index (0=Mon)
  const toMondayFirstIndex = (jsDay: number) => (jsDay + 6) % 7

  useEffect(() => {
    fetchScheduleData()
  }, [userId])

  const fetchScheduleData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/users/${userId}/schedule`)
      const data = await response.json()
      
      if (data.error) throw new Error(data.error)
      
      setScheduleByDay(data.scheduleByDay || {})
      setScheduleByWeekAndDay(data.scheduleByWeekAndDay || {})
      setCompletionsByDate(data.completionsByDate || {})
      setCompletionsByDateAndWorkout(data.completionsByDateAndWorkout || {})
      setProgramStartDate(data.programStartDate || null)
      setMaxWeek(data.maxWeek || 1)
    } catch (err) {
      console.error('Failed to fetch schedule:', err)
    } finally {
      setLoading(false)
    }
  }

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
    
    const startDate = new Date(programStartDate + 'T00:00:00')
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    startDate.setHours(0, 0, 0, 0)
    
    const daysSinceStart = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysSinceStart < 0) return 1 // Before program start, show week 1
    
    const weekNum = Math.floor(daysSinceStart / 7) + 1
    
    // Cycle through weeks if we exceed maxWeek (programs repeat)
    if (weekNum > maxWeek) {
      return ((weekNum - 1) % maxWeek) + 1
    }
    
    return weekNum
  }

  // Get workouts for a specific date (considering week number)
  const getWorkoutsForDate = (date: Date): WorkoutSchedule[] => {
    const dayOfWeek = date.getDay()
    
    // If no program start date or no week data, use legacy flat schedule
    if (!programStartDate || Object.keys(scheduleByWeekAndDay).length === 0) {
      const legacy = scheduleByDay[dayOfWeek]
      return legacy ? [legacy] : []
    }
    
    // Check if date is before program start - no workouts (rest day)
    const startDate = new Date(programStartDate + 'T00:00:00')
    startDate.setHours(0, 0, 0, 0)
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    if (targetDate < startDate) {
      return []
    }
    
    const weekNum = getWeekForDate(date)
    
    // Return workouts for this specific week+day
    // Use empty array fallback if day not defined (rest day)
    const workouts = scheduleByWeekAndDay[weekNum]?.[dayOfWeek]
    return Array.isArray(workouts) ? workouts : []
  }

  // Check if a specific workout is completed for a date
  const isWorkoutCompleted = (date: Date, workout: WorkoutSchedule): boolean => {
    const dateStr = formatDateLocal(date)
    
    // Check precise match first (date:workoutId:clientProgramId)
    const keyWithProgram = `${dateStr}:${workout.workoutId}:${workout.clientProgramId}`
    if (completionsByDateAndWorkout[keyWithProgram]) return true
    
    // Fallback to date:workoutId (for legacy completions without clientProgramId)
    const keyWithoutProgram = `${dateStr}:${workout.workoutId}`
    if (completionsByDateAndWorkout[keyWithoutProgram]) return true
    
    return false
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
      programStart.setHours(0, 0, 0, 0)
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

  // Fetch workout details for a specific date
  const fetchWorkoutDetails = async (date: Date) => {
    setLoadingDetails(true)
    setSelectedDate(date)
    
    const dateStr = formatDateLocal(date)
    const workouts = getWorkoutsForDate(date)
    const firstWorkout = workouts[0]
    
    try {
      // Use API to fetch workout details (bypasses RLS)
      const response = await fetch(`/api/coaching/details?clientId=${userId}&date=${dateStr}`)
      const data = await response.json()
      
      if (data.workoutLog) {
        setWorkoutDetails(data.workoutLog)
      } else {
        // No completion yet - show scheduled workout info with preview
        if (firstWorkout) {
          // Fetch workout preview (exercises, sets)
          const previewResponse = await fetch(`/api/coaching/preview?workoutId=${firstWorkout.workoutId}`)
          const previewData = await previewResponse.json()
          
          setWorkoutDetails({
            id: null,
            workout_name: firstWorkout.workoutName,
            completed_at: null,
            notes: null,
            rating: null,
            trainer_name: null,
            sets: [],
            scheduled: true,
            workoutId: firstWorkout.workoutId,
            programName: firstWorkout.programName,
            preview: previewData.workout?.exercises || []
          })
        } else {
          setWorkoutDetails(null)
        }
      }
    } catch (err) {
      console.error('Failed to fetch workout details:', err)
      setWorkoutDetails(null)
    } finally {
      setLoadingDetails(false)
    }
  }

  const closeModal = () => {
    setSelectedDate(null)
    setWorkoutDetails(null)
    setIsEditing(false)
    setEditedSets(new Map())
  }

  const handleEditSet = (exerciseId: string, setNumber: number, field: 'weight_kg' | 'reps_completed', value: number | null) => {
    const key = `${exerciseId}-${setNumber}`
    setEditedSets(prev => {
      const newMap = new Map(prev)
      const existing = newMap.get(key) || { weight_kg: null, reps_completed: null }
      newMap.set(key, { ...existing, [field]: value })
      return newMap
    })
  }

  const saveEdits = async () => {
    if (!workoutDetails?.id) return
    setSavingEdits(true)
    
    try {
      const setsToUpdate = workoutDetails.sets.map(set => {
        const key = `${set.exercise_id}-${set.set_number}`
        const edited = editedSets.get(key)
        return {
          exercise_id: set.exercise_id,
          set_number: set.set_number,
          weight_kg: edited?.weight_kg ?? set.weight_kg,
          reps_completed: edited?.reps_completed ?? set.reps_completed
        }
      }).filter(s => s.weight_kg !== null || s.reps_completed !== null)

      const response = await fetch('/api/coaching/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutLogId: workoutDetails.id,
          sets: setsToUpdate
        })
      })

      if (!response.ok) throw new Error('Failed to save')
      
      // Refresh the details
      if (selectedDate) {
        await fetchWorkoutDetails(selectedDate)
      }
      setIsEditing(false)
      setEditedSets(new Map())
    } catch (err) {
      console.error('Failed to save edits:', err)
      alert('Failed to save changes')
    } finally {
      setSavingEdits(false)
    }
  }

  // Get week dates starting from Monday
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
    
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d))
    }
    
    return days
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 border-green-500/50 text-green-400'
      case 'partial': return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
      case 'skipped': return 'bg-red-500/20 border-red-500/50 text-red-400'
      case 'upcoming': return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
      default: return 'bg-zinc-800/50 border-zinc-700 text-zinc-500'
    }
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'partial': return 'bg-yellow-500'
      case 'skipped': return 'bg-red-500'
      case 'upcoming': return 'bg-yellow-500'
      default: return 'bg-zinc-700'
    }
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
        </div>
      </div>
    )
  }

  const weekDates = getWeekDates()
  const calendarDays = getCalendarDays()
  const hasSchedule = Object.keys(scheduleByDay).length > 0 || Object.keys(scheduleByWeekAndDay).length > 0

  if (!hasSchedule) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-yellow-400" />
          <h2 className="text-lg font-semibold text-white">Training Schedule</h2>
        </div>
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No active program with scheduled workouts</p>
          <p className="text-zinc-500 text-sm mt-1">Assign a program with day-of-week scheduling to see the calendar</p>
        </div>
      </div>
    )
  }

  // Get current week number for display
  const currentWeekNum = getWeekForDate(today)

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-yellow-400" />
          <h2 className="text-lg font-semibold text-white">Training Schedule</h2>
        </div>
        {maxWeek > 1 && (
          <span className="px-2 py-1 bg-yellow-400/20 text-yellow-400 text-xs font-medium rounded">
            Week {currentWeekNum} of {maxWeek}
          </span>
        )}
      </div>

      {/* Today's Workout - Coach Session */}
      {(() => {
        const todayWorkouts = getWorkoutsForDate(today)
        const incompleteWorkouts = todayWorkouts.filter(w => !isWorkoutCompleted(today, w))
        
        if (incompleteWorkouts.length > 0) {
          const firstIncomplete = incompleteWorkouts[0]
          return (
            <div className="mb-6 p-4 bg-yellow-400/10 border border-yellow-400/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-400 text-xs font-medium uppercase tracking-wider mb-1">Today's Workout</p>
                  <p className="text-white font-semibold">{firstIncomplete.workoutName}</p>
                  <p className="text-zinc-400 text-sm">{firstIncomplete.programName}</p>
                </div>
                <Link
                  href={`/users/${userId}/coach/${firstIncomplete.workoutId}`}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-xl transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Coach Session
                </Link>
              </div>
            </div>
          )
        }
        return null
      })()}

      {/* Weekly View */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">This Week</h3>
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, idx) => {
            const isToday = date.toDateString() === today.toDateString()
            const dayOfWeek = date.getDay() // 0=Sun for scheduleByDay lookup
            const dayIndex = toMondayFirstIndex(dayOfWeek) // 0=Mon for display
            const workouts = getWorkoutsForDate(date)
            const hasWorkouts = workouts.length > 0
            const status = getDateStatus(date)
            const firstWorkout = workouts[0]
            
            return (
              <div 
                key={idx}
                onClick={() => hasWorkouts && fetchWorkoutDetails(date)}
                className={`rounded-xl border p-3 text-center transition-all ${
                  hasWorkouts
                    ? `${getStatusColor(status)} cursor-pointer hover:ring-2 hover:ring-white/30`
                    : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <div className="text-xs text-zinc-500 mb-1">{daysOfWeek[dayIndex]}</div>
                <div className={`text-lg font-bold ${hasWorkouts ? 'text-white' : 'text-zinc-600'}`}>
                  {date.getDate()}
                </div>
                {/* Today indicator - white dot only on today */}
                {isToday && (
                  <div className="w-2 h-2 rounded-full mx-auto mt-1 bg-white" />
                )}
                {hasWorkouts && firstWorkout && (
                  <div className="text-[10px] text-zinc-400 mt-1 truncate" title={firstWorkout.workoutName}>
                    {firstWorkout.workoutName.length > 8 ? firstWorkout.workoutName.slice(0, 8) + '...' : firstWorkout.workoutName}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Monthly Calendar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
            {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h3>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-zinc-400" />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>
        
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {daysOfWeek.map(day => (
              <div key={day} className="text-center text-zinc-500 text-xs font-medium py-1">
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
                <div
                  key={date.toISOString()}
                  onClick={() => hasWorkouts && fetchWorkoutDetails(date)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all ${
                    hasWorkouts
                      ? `${getStatusColor(status)} cursor-pointer hover:ring-2 hover:ring-white/30`
                      : 'text-zinc-600'
                  } ${hasWorkouts ? 'border' : ''} ${isToday ? 'font-bold' : ''}`}
                >
                  <span className={isToday && !hasWorkouts ? 'text-white' : ''}>{date.getDate()}</span>
                  {/* Today indicator - white dot */}
                  {isToday && (
                    <div className="w-1 h-1 rounded-full mt-0.5 bg-white" />
                  )}
                </div>
              )
            })}
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-zinc-400 text-xs">Complete</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-zinc-400 text-xs">Missed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-zinc-400 text-xs">Upcoming</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span className="text-zinc-400 text-xs">Today</span>
            </div>
          </div>
          <p className="text-center text-zinc-500 text-xs mt-2">Click any workout day to view details</p>
        </div>
      </div>

      {/* Workout Details Modal */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center" onClick={closeModal}>
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-lg max-h-[80vh] overflow-hidden mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </h3>
                  {workoutDetails && (
                    <p className="text-sm text-zinc-400">{workoutDetails.workout_name}</p>
                  )}
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="p-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-track]:bg-zinc-800" style={{ overflowY: 'scroll', maxHeight: '400px' }}>
              {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
                </div>
              ) : workoutDetails ? (
                <div className="space-y-4">
                  {/* Meta info */}
                  <div className="flex flex-wrap gap-3 text-sm">
                    {workoutDetails.trainer_name && (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                        Coach: {workoutDetails.trainer_name}
                      </span>
                    )}
                    {workoutDetails.rating && (
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">
                        {'★'.repeat(workoutDetails.rating)}
                      </span>
                    )}
                  </div>

                  {/* Notes */}
                  {workoutDetails.notes && (
                    <div className="p-3 bg-zinc-800/50 rounded-xl">
                      <p className="text-sm text-zinc-400">{workoutDetails.notes}</p>
                    </div>
                  )}

                  {/* Edit button */}
                  {workoutDetails.id && !workoutDetails.scheduled && (
                    <div className="flex justify-end">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setIsEditing(false); setEditedSets(new Map()) }}
                            className="px-3 py-1 text-sm text-zinc-400 hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveEdits}
                            disabled={savingEdits}
                            className="px-3 py-1 text-sm bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg disabled:opacity-50"
                          >
                            {savingEdits ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-3 py-1 text-sm text-yellow-400 hover:text-yellow-300"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}

                  {/* Exercises and sets */}
                  {(() => {
                    // Group sets by exercise
                    const exerciseGroups = workoutDetails.sets.reduce((acc, set) => {
                      if (!acc[set.exercise_name]) acc[set.exercise_name] = []
                      acc[set.exercise_name].push(set)
                      return acc
                    }, {} as Record<string, typeof workoutDetails.sets>)

                    return Object.entries(exerciseGroups).map(([exerciseName, sets]) => (
                      <div key={exerciseName} className="bg-zinc-800/30 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Dumbbell className="w-4 h-4 text-yellow-400" />
                          <h4 className="font-medium text-white">{exerciseName}</h4>
                        </div>
                        <div className="space-y-2">
                          {sets.map(set => {
                            const key = `${set.exercise_id}-${set.set_number}`
                            const edited = editedSets.get(key)
                            const currentWeight = edited?.weight_kg ?? set.weight_kg
                            const currentReps = edited?.reps_completed ?? set.reps_completed
                            
                            return (
                              <div key={set.set_number} className="flex items-center justify-between text-sm">
                                <span className="text-zinc-500">Set {set.set_number}</span>
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="0.5"
                                      value={currentWeight ?? ''}
                                      onChange={(e) => handleEditSet(set.exercise_id!, set.set_number, 'weight_kg', e.target.value ? parseFloat(e.target.value) : null)}
                                      className="w-16 px-2 py-1 bg-zinc-700 border border-zinc-600 rounded text-white text-center text-sm"
                                      placeholder="kg"
                                    />
                                    <span className="text-zinc-500">×</span>
                                    <input
                                      type="number"
                                      value={currentReps ?? ''}
                                      onChange={(e) => handleEditSet(set.exercise_id!, set.set_number, 'reps_completed', e.target.value ? parseInt(e.target.value) : null)}
                                      className="w-14 px-2 py-1 bg-zinc-700 border border-zinc-600 rounded text-white text-center text-sm"
                                      placeholder="reps"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-white font-medium">
                                    {set.weight_kg !== null ? `${set.weight_kg}kg` : '—'} × {set.reps_completed ?? '—'}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  })()}

                  {workoutDetails.sets.length === 0 && !workoutDetails.scheduled && (
                    <p className="text-zinc-500 text-center py-4">No set data recorded</p>
                  )}

                  {/* Show workout preview and coaching button for scheduled workouts */}
                  {workoutDetails.scheduled && workoutDetails.workoutId && (
                    <div className="space-y-4">
                      {workoutDetails.programName && (
                        <p className="text-zinc-500 text-sm text-center">{workoutDetails.programName}</p>
                      )}
                      
                      {/* Workout Preview - show exercises and sets */}
                      {workoutDetails.preview && workoutDetails.preview.length > 0 && (
                        <div className="space-y-3">
                          {workoutDetails.preview.map((exercise, idx) => (
                            <div key={idx} className="bg-zinc-800/30 rounded-xl p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Dumbbell className="w-4 h-4 text-yellow-400" />
                                <h4 className="font-medium text-white">{exercise.name}</h4>
                              </div>
                              <div className="text-sm text-zinc-400">
                                {exercise.sets.length} sets × {exercise.sets[0]?.reps || '—'} reps
                                {exercise.sets[0]?.intensity && ` @ ${exercise.sets[0].intensity}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Show Start Coaching Session ONLY on today */}
                      {selectedDate && (() => {
                        const todayStart = new Date()
                        todayStart.setHours(0, 0, 0, 0)
                        const todayEnd = new Date()
                        todayEnd.setHours(23, 59, 59, 999)
                        const isToday = selectedDate >= todayStart && selectedDate <= todayEnd
                        const isPast = selectedDate < todayStart
                        
                        if (isToday) {
                          return (
                            <div className="text-center pt-2">
                              <Link
                                href={`/users/${userId}/coach/${workoutDetails.workoutId}`}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-xl transition-colors"
                              >
                                <Play className="w-4 h-4" />
                                Start Coaching Session
                              </Link>
                            </div>
                          )
                        } else if (isPast) {
                          return (
                            <p className="text-zinc-500 text-sm text-center pt-2">This workout was not completed</p>
                          )
                        } else {
                          return (
                            <p className="text-zinc-500 text-sm text-center pt-2">Scheduled for {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                          )
                        }
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Dumbbell className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-zinc-400">No workout data found for this date</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
