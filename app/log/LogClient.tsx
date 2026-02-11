'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Calendar, Check, Dumbbell, ArrowLeft } from 'lucide-react'
import { createClient } from '../lib/supabase/client'
import ExerciseLogger from './ExerciseLogger'

interface ExerciseSet {
  setNumber: number
  reps: string
  intensityType: string
  intensityValue: string
}

interface Exercise {
  id: string
  name: string
  orderIndex: number
  notes?: string
  supersetGroup?: string
  sets: ExerciseSet[]
}

interface WorkoutSchedule {
  workoutId: string
  workoutName: string
  programName: string
  programCategory: string
  clientProgramId: string
  exercises: Exercise[]
}

interface LogClientProps {
  scheduleByDay: Record<number, WorkoutSchedule[]>
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Format date for display
function formatDisplayDate(date: Date): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const compareDate = new Date(date)
  compareDate.setHours(0, 0, 0, 0)
  
  const diffDays = Math.round((compareDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays === 1) return 'Tomorrow'
  
  return date.toLocaleDateString(undefined, { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  })
}

// Get day name
function getDayName(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long' })
}

export default function LogClient({ scheduleByDay }: LogClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  // Initialize date from URL param or default to today
  const getInitialDate = () => {
    const dateParam = searchParams.get('date')
    if (dateParam) {
      const parsed = new Date(dateParam + 'T12:00:00')
      if (!isNaN(parsed.getTime())) {
        return parsed
      }
    }
    return new Date()
  }
  
  const [selectedDate, setSelectedDate] = useState(getInitialDate)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [completedWorkouts, setCompletedWorkouts] = useState<Record<string, boolean>>({})
  const [workoutLogIds, setWorkoutLogIds] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  
  // Swipe handling
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Get workouts for selected date
  const dayOfWeek = selectedDate.getDay()
  const workouts = scheduleByDay[dayOfWeek] || []
  const dateStr = formatDate(selectedDate)

  // Fetch completion status and existing logs for selected date
  useEffect(() => {
    fetchCompletionStatus()
  }, [dateStr])

  const fetchCompletionStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check completions
    const { data: completions } = await supabase
      .from('workout_completions')
      .select('workout_id')
      .eq('client_id', user.id)
      .eq('scheduled_date', dateStr)

    const completed: Record<string, boolean> = {}
    completions?.forEach(c => {
      completed[c.workout_id] = true
    })
    setCompletedWorkouts(completed)

    // Get existing workout_log IDs for this date
    const { data: logs } = await supabase
      .from('workout_logs')
      .select('id, workout_id')
      .eq('client_id', user.id)
      .eq('scheduled_date', dateStr)

    const logIds: Record<string, string> = {}
    logs?.forEach(l => {
      logIds[l.workout_id] = l.id
    })
    setWorkoutLogIds(logIds)
  }

  // Navigation - update URL when date changes
  const navigateToDate = (date: Date) => {
    setSelectedDate(date)
    const dateStr = formatDate(date)
    router.replace(`/log?date=${dateStr}`, { scroll: false })
  }

  const goToPreviousDay = () => {
    const prev = new Date(selectedDate)
    prev.setDate(prev.getDate() - 1)
    navigateToDate(prev)
  }

  const goToNextDay = () => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + 1)
    navigateToDate(next)
  }

  const goToToday = () => {
    navigateToDate(new Date())
  }

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return
    
    const diff = touchStartX.current - touchEndX.current
    const threshold = 50
    
    if (diff > threshold) {
      goToNextDay()
    } else if (diff < -threshold) {
      goToPreviousDay()
    }
    
    touchStartX.current = null
    touchEndX.current = null
  }

  // Complete workout
  const completeWorkout = async (workoutId: string, clientProgramId: string) => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    try {
      // Create completion record
      await supabase
        .from('workout_completions')
        .upsert({
          client_id: user.id,
          workout_id: workoutId,
          client_program_id: clientProgramId,
          scheduled_date: dateStr,
          completed_at: new Date().toISOString()
        }, {
          onConflict: 'client_id,workout_id,scheduled_date'
        })

      setCompletedWorkouts(prev => ({ ...prev, [workoutId]: true }))
    } catch (err) {
      console.error('Failed to complete workout:', err)
    }
    
    setSaving(false)
  }

  // Get or create workout log for saving sets
  const getOrCreateWorkoutLog = async (workoutId: string): Promise<string | null> => {
    // Check if we already have one cached
    if (workoutLogIds[workoutId]) {
      return workoutLogIds[workoutId]
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Check if one exists
    const { data: existing } = await supabase
      .from('workout_logs')
      .select('id')
      .eq('client_id', user.id)
      .eq('workout_id', workoutId)
      .eq('scheduled_date', dateStr)
      .single()

    if (existing) {
      setWorkoutLogIds(prev => ({ ...prev, [workoutId]: existing.id }))
      return existing.id
    }

    // Create new
    const { data: newLog, error } = await supabase
      .from('workout_logs')
      .insert({
        client_id: user.id,
        workout_id: workoutId,
        scheduled_date: dateStr,
        completed_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to create workout log:', error)
      return null
    }

    setWorkoutLogIds(prev => ({ ...prev, [workoutId]: newLog.id }))
    return newLog.id
  }

  // Category colors
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'strength': return 'bg-blue-500'
      case 'cardio': return 'bg-green-500'
      case 'hyrox': return 'bg-orange-500'
      case 'hybrid': return 'bg-purple-500'
      default: return 'bg-yellow-500'
    }
  }

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-black"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header with date navigation */}
      <header className="sticky top-0 bg-black/95 backdrop-blur-lg border-b border-zinc-800 z-40">
        {/* Back button row */}
        <div className="flex items-center px-4 pt-3 pb-1">
          <button 
            onClick={() => router.push('/workouts')}
            className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
        </div>
        
        {/* Date navigation */}
        <div className="flex items-center justify-between px-4 py-2">
          <button 
            onClick={goToPreviousDay}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <button 
            onClick={() => setShowDatePicker(true)}
            className="flex flex-col items-center"
          >
            <span className="text-lg font-bold text-white">{formatDisplayDate(selectedDate)}</span>
            <span className="text-xs text-zinc-500">{getDayName(selectedDate)}</span>
          </button>
          
          <button 
            onClick={goToNextDay}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
        
        {/* Quick jump to today */}
        {formatDate(selectedDate) !== formatDate(new Date()) && (
          <div className="px-4 pb-2">
            <button
              onClick={goToToday}
              className="w-full py-2 text-sm text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              Jump to Today
            </button>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="px-4 py-4 pb-24">
        {workouts.length === 0 ? (
          // Rest day
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
              <span className="text-4xl">😴</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Rest Day</h2>
            <p className="text-zinc-500 text-center">No workout scheduled for {getDayName(selectedDate)}</p>
            <p className="text-zinc-600 text-sm mt-4">Swipe to view other days</p>
          </div>
        ) : (
          // Workouts for the day
          <div className="space-y-6">
            {workouts.map((workout) => {
              const isCompleted = completedWorkouts[workout.workoutId]
              
              return (
                <div 
                  key={workout.workoutId}
                  className={`bg-zinc-900 border rounded-2xl overflow-hidden ${
                    isCompleted ? 'border-green-500/30' : 'border-zinc-800'
                  }`}
                >
                  {/* Workout header */}
                  <div className={`p-4 border-b ${isCompleted ? 'border-green-500/20 bg-green-500/5' : 'border-zinc-800'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getCategoryColor(workout.programCategory)}`} />
                        <div>
                          <h3 className={`font-bold ${isCompleted ? 'text-green-400' : 'text-white'}`}>
                            {workout.workoutName}
                          </h3>
                          <p className="text-zinc-500 text-sm">{workout.programName}</p>
                        </div>
                      </div>
                      {isCompleted && (
                        <div className="flex items-center gap-1 text-green-400">
                          <Check className="w-5 h-5" />
                          <span className="text-sm font-medium">Done</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Exercises */}
                  <div className="p-4 space-y-3">
                    {workout.exercises.map((exercise, idx) => (
                      <ExerciseLogger
                        key={exercise.id}
                        exercise={exercise}
                        index={idx}
                        workoutId={workout.workoutId}
                        scheduledDate={dateStr}
                        getOrCreateWorkoutLog={getOrCreateWorkoutLog}
                        existingLogId={workoutLogIds[workout.workoutId]}
                      />
                    ))}
                  </div>

                  {/* Complete button */}
                  {!isCompleted && workout.exercises.length > 0 && (
                    <div className="p-4 border-t border-zinc-800">
                      <button
                        onClick={() => completeWorkout(workout.workoutId, workout.clientProgramId)}
                        disabled={saving}
                        className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        {saving ? (
                          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Check className="w-5 h-5" />
                            Complete Workout
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDatePicker(false)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-4 text-center">Select Date</h3>
            <input
              type="date"
              value={formatDate(selectedDate)}
              onChange={(e) => {
                navigateToDate(new Date(e.target.value + 'T12:00:00'))
                setShowDatePicker(false)
              }}
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-center text-lg [color-scheme:dark]"
            />
            <button
              onClick={() => {
                goToToday()
                setShowDatePicker(false)
              }}
              className="w-full mt-3 py-3 bg-yellow-400 text-black font-bold rounded-xl"
            >
              Go to Today
            </button>
          </div>
        </div>
      )}

      {/* Swipe hint */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 text-zinc-600 text-xs flex items-center gap-2">
        <ChevronLeft className="w-4 h-4" />
        <span>Swipe to change date</span>
        <ChevronRight className="w-4 h-4" />
      </div>
    </div>
  )
}
