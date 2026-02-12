'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'
import { 
  ArrowLeft, 
  Dumbbell, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  Trophy,
  Play,
  Square,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react'
import Link from 'next/link'

interface ExerciseSet {
  id: string
  set_number: number
  reps: string
  intensity_type: string
  intensity_value: string
  rest_seconds?: number
  weight_type?: string
  notes: string
}

interface WorkoutExercise {
  id: string
  exercise_name: string
  order_index: number
  exercise_sets: ExerciseSet[]
}

interface Workout {
  id: string
  name: string
  program_workouts: {
    id: string
    name: string
  }
}

interface SetLog {
  set_number: number
  weight_kg: number | null
  reps_completed: number | null
}

interface Client1RM {
  exercise_name: string
  weight_kg: number
}

export default function CoachSessionPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const clientId = params.id as string
  const workoutId = params.workoutId as string
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workout, setWorkout] = useState<{ name: string; programName: string } | null>(null)
  const [exercises, setExercises] = useState<WorkoutExercise[]>([])
  const [client1RMs, setClient1RMs] = useState<Map<string, number>>(new Map())
  const [lastWeights, setLastWeights] = useState<Map<string, number>>(new Map()) // key: exerciseId-setNumber
  const [clientName, setClientName] = useState('')
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)
  const [setLogs, setSetLogs] = useState<Map<string, SetLog>>(new Map()) // key: exerciseId-setNumber
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set())
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [clientProgramId, setClientProgramId] = useState<string | null>(null)
  const [sessionNotes, setSessionNotes] = useState('')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [trainerId, setTrainerId] = useState<string | null>(null)

  // Calendar modal state
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [scheduleByDay, setScheduleByDay] = useState<Record<number, { workoutId: string; workoutName: string; programName: string }>>({})
  const [completionsByDate, setCompletionsByDate] = useState<Record<string, string>>({})
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<Date | null>(null)
  const [historyDetails, setHistoryDetails] = useState<any>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Local storage key for this workout session
  const storageKey = `coach-session-${clientId}-${workoutId}`

  // Get current trainer's ID
  useEffect(() => {
    async function getTrainerId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setTrainerId(user.id)
      }
    }
    getTrainerId()
  }, [supabase])

  // Restore from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data.setLogs) {
          setSetLogs(new Map(Object.entries(data.setLogs)))
        }
        if (data.completedExercises) {
          setCompletedExercises(new Set(data.completedExercises))
        }
        if (data.sessionNotes) {
          setSessionNotes(data.sessionNotes)
        }
        if (data.sessionStarted) {
          setSessionStarted(true)
        }
      } catch (e) {
        console.error('Failed to restore session:', e)
      }
    }
  }, [storageKey])

  // Auto-save to localStorage whenever data changes
  useEffect(() => {
    if (!sessionStarted) return
    
    const data = {
      setLogs: Object.fromEntries(setLogs),
      completedExercises: Array.from(completedExercises),
      sessionNotes,
      sessionStarted,
      savedAt: new Date().toISOString()
    }
    localStorage.setItem(storageKey, JSON.stringify(data))
    setLastSaved(new Date())
  }, [setLogs, completedExercises, sessionNotes, sessionStarted, storageKey])

  // Clear localStorage when session is complete
  useEffect(() => {
    if (sessionComplete) {
      localStorage.removeItem(storageKey)
    }
  }, [sessionComplete, storageKey])

  useEffect(() => {
    fetchData()
  }, [clientId, workoutId])

  async function fetchData() {
    setLoading(true)

    // Get client name
    const { data: clientData } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', clientId)
      .single()
    
    if (clientData) setClientName(clientData.full_name || 'Client')

    // Get workout details
    const { data: workoutData } = await supabase
      .from('program_workouts')
      .select(`
        id,
        name,
        programs (
          id,
          name
        ),
        workout_exercises (
          id,
          exercise_name,
          order_index,
          exercise_sets (
            id,
            set_number,
            reps,
            intensity_type,
            intensity_value,
            rest_seconds,
            weight_type,
            notes
          )
        )
      `)
      .eq('id', workoutId)
      .single()

    if (workoutData) {
      const program = workoutData.programs as any
      setWorkout({
        name: workoutData.name,
        programName: program?.name || ''
      })
      
      // Sort exercises by order_index and sets by set_number
      const sortedExercises = (workoutData.workout_exercises || [])
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((ex: any) => ({
          ...ex,
          exercise_sets: (ex.exercise_sets || []).sort((a: any, b: any) => a.set_number - b.set_number)
        }))
      
      setExercises(sortedExercises)
      
      // Auto-expand first exercise
      if (sortedExercises.length > 0) {
        setExpandedExercise(sortedExercises[0].id)
      }
    }

    // Get client's 1RMs for suggested weights
    const { data: rmData } = await supabase
      .from('client_1rms')
      .select('exercise_name, weight_kg')
      .eq('client_id', clientId)

    if (rmData) {
      const rmMap = new Map(rmData.map(rm => [rm.exercise_name, rm.weight_kg]))
      setClient1RMs(rmMap)
    }

    // Get last weights used for this workout
    const { data: lastWorkoutLog } = await supabase
      .from('workout_logs')
      .select('id')
      .eq('client_id', clientId)
      .eq('workout_id', workoutId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    if (lastWorkoutLog) {
      const { data: lastSets } = await supabase
        .from('set_logs')
        .select('exercise_id, set_number, weight_kg')
        .eq('workout_log_id', lastWorkoutLog.id)

      if (lastSets) {
        const weightsMap = new Map<string, number>()
        lastSets.forEach(set => {
          if (set.weight_kg) {
            weightsMap.set(`${set.exercise_id}-${set.set_number}`, set.weight_kg)
          }
        })
        setLastWeights(weightsMap)
      }
    }

    // Get client's active program assignment for this workout
    const { data: clientPrograms } = await supabase
      .from('client_programs')
      .select('id, program_id')
      .eq('client_id', clientId)
      .eq('is_active', true)

    if (clientPrograms && clientPrograms.length > 0) {
      // Find which program contains this workout
      const { data: workoutProgram } = await supabase
        .from('program_workouts')
        .select('program_id')
        .eq('id', workoutId)
        .single()

      if (workoutProgram) {
        const matchingProgram = clientPrograms.find(cp => cp.program_id === workoutProgram.program_id)
        if (matchingProgram) {
          setClientProgramId(matchingProgram.id)
        }
      }
    }

    setLoading(false)
  }

  // Calendar helper functions
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const toMondayFirstIndex = (jsDay: number) => (jsDay + 6) % 7
  
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const fetchScheduleData = async () => {
    try {
      const response = await fetch(`/api/users/${clientId}/schedule`)
      const { scheduleByDay: schedule, completionsByDate: completions } = await response.json()
      setScheduleByDay(schedule || {})
      setCompletionsByDate(completions || {})
    } catch (err) {
      console.error('Failed to fetch schedule:', err)
    }
  }

  const fetchHistoryDetails = async (date: Date) => {
    setLoadingHistory(true)
    setSelectedHistoryDate(date)
    
    const dateStr = formatDateLocal(date)
    const dayOfWeek = date.getDay()
    const scheduledWorkout = scheduleByDay[dayOfWeek]
    
    try {
      const response = await fetch(`/api/coaching/details?clientId=${clientId}&date=${dateStr}`)
      const data = await response.json()
      
      if (data.workoutLog) {
        setHistoryDetails(data.workoutLog)
      } else if (scheduledWorkout) {
        // No completion yet - show scheduled workout info
        setHistoryDetails({
          workout_name: scheduledWorkout.workoutName,
          program_name: scheduledWorkout.programName,
          notes: null,
          sets: [],
          scheduled: true
        })
      } else {
        setHistoryDetails(null)
      }
    } catch (err) {
      console.error('Failed to fetch history:', err)
      setHistoryDetails(null)
    } finally {
      setLoadingHistory(false)
    }
  }

  const openCalendar = () => {
    setShowCalendar(true)
    fetchScheduleData()
  }

  const getCalendarDays = () => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
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

  const getDateStatus = (date: Date): 'completed' | 'skipped' | 'upcoming' | 'rest' => {
    const dateStr = formatDateLocal(date)
    const dayOfWeek = date.getDay()
    const hasWorkout = scheduleByDay[dayOfWeek]
    const today = new Date()
    
    if (!hasWorkout) return 'rest'
    
    const todayStart = new Date(today)
    todayStart.setHours(0, 0, 0, 0)
    const dateStart = new Date(date)
    dateStart.setHours(0, 0, 0, 0)
    
    if (completionsByDate[dateStr]) return 'completed'
    if (dateStart < todayStart) return 'skipped'
    return 'upcoming'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 border-green-500/50 text-green-400'
      case 'skipped': return 'bg-red-500/20 border-red-500/50 text-red-400'
      case 'upcoming': return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
      default: return 'bg-zinc-800/50 border-zinc-700 text-zinc-500'
    }
  }

  const calculateSuggestedWeight = (exerciseName: string, intensityType: string, intensityValue: string): number | null => {
    const oneRM = client1RMs.get(exerciseName)
    if (!oneRM) return null

    if (intensityType === 'percentage') {
      const percentage = parseFloat(intensityValue) / 100
      return Math.round(oneRM * percentage * 2) / 2 // Round to nearest 0.5
    }
    
    if (intensityType === 'rpe') {
      // Rough RPE to percentage conversion
      const rpe = parseFloat(intensityValue)
      const percentage = 0.5 + (rpe / 20) // RPE 10 = ~100%, RPE 6 = ~80%
      return Math.round(oneRM * percentage * 2) / 2
    }

    return null
  }

  const getSetKey = (exerciseId: string, setNumber: number) => `${exerciseId}-${setNumber}`

  const updateSetLog = (exerciseId: string, setNumber: number, field: 'weight_kg' | 'reps_completed', value: number | null) => {
    const key = getSetKey(exerciseId, setNumber)
    setSetLogs(prev => {
      const newMap = new Map(prev)
      const existing = newMap.get(key) || { set_number: setNumber, weight_kg: null, reps_completed: null }
      newMap.set(key, { ...existing, [field]: value })
      return newMap
    })
  }

  // Auto-fill to subsequent sets on blur (when user finishes typing)
  // Ladder behaviour: always update ALL subsequent sets to match current value
  const autoFillSubsequentSets = (exerciseId: string, setNumber: number, field: 'weight_kg' | 'reps_completed', value: number | null, totalSets: number) => {
    if (value === null) return
    
    setSetLogs(prev => {
      const newMap = new Map(prev)
      for (let i = setNumber + 1; i <= totalSets; i++) {
        const nextKey = getSetKey(exerciseId, i)
        const nextExisting = newMap.get(nextKey) || { set_number: i, weight_kg: null, reps_completed: null }
        // Always cascade down - update all subsequent sets
        newMap.set(nextKey, { ...nextExisting, [field]: value })
      }
      return newMap
    })
  }

  const markExerciseComplete = (exerciseId: string) => {
    setCompletedExercises(prev => {
      const newSet = new Set(prev)
      newSet.add(exerciseId)
      return newSet
    })

    // Auto-expand next incomplete exercise
    const currentIndex = exercises.findIndex(e => e.id === exerciseId)
    for (let i = currentIndex + 1; i < exercises.length; i++) {
      if (!completedExercises.has(exercises[i].id)) {
        setExpandedExercise(exercises[i].id)
        return
      }
    }
  }

  const completeSession = async () => {
    if (!clientProgramId) {
      alert('No active program found for this client')
      return
    }

    setSaving(true)

    try {
      // Build set logs array
      const setLogsArray: any[] = []
      for (const exercise of exercises) {
        for (const set of exercise.exercise_sets) {
          const key = getSetKey(exercise.id, set.set_number)
          const log = setLogs.get(key)
          
          if (log && (log.weight_kg !== null || log.reps_completed !== null)) {
            setLogsArray.push({
              exercise_id: exercise.id,
              set_number: set.set_number,
              weight_kg: log.weight_kg,
              reps_completed: log.reps_completed
            })
          }
        }
      }

      // Call API to save session (uses admin client to bypass RLS)
      const response = await fetch('/api/coaching/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          workoutId,
          clientProgramId,
          sessionNotes: sessionNotes.trim() || null,
          setLogs: setLogsArray,
          exercises: exercises.map(e => ({ id: e.id, exercise_name: e.exercise_name }))
        })
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save session')
      }

      setSessionComplete(true)
    } catch (err: any) {
      console.error('Failed to save session:', err)
      alert(`Failed to save session: ${err?.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
      </div>
    )
  }

  if (sessionComplete) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Session Complete!</h1>
          <p className="text-zinc-400 mb-6">
            Workout logged for {clientName}. All data has been saved to their account.
          </p>
          <Link
            href={`/users/${clientId}?tab=progress`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-xl transition-colors"
          >
            View Client Progress
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`/users/${clientId}?tab=schedule`}
          className="p-2 hover:bg-zinc-800 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </Link>
        <button
          onClick={openCalendar}
          className="p-2 hover:bg-zinc-800 rounded-xl transition-colors"
          title="View workout history"
        >
          <Calendar className="w-5 h-5 text-yellow-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{workout?.name}</h1>
          <p className="text-zinc-500 text-sm">
            Coaching session for {clientName}
          </p>
        </div>
        {sessionStarted && (
          <button
            onClick={completeSession}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Complete
          </button>
        )}
      </div>

      {/* Start Session Button */}
      {!sessionStarted && (
        <div className="card p-8 text-center mb-6">
          <Dumbbell className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Ready to Coach?</h2>
          <p className="text-zinc-500 mb-6">
            {exercises.length} exercises • {exercises.reduce((sum, e) => sum + e.exercise_sets.length, 0)} sets total
          </p>
          <button
            onClick={() => setSessionStarted(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-xl transition-colors"
          >
            <Play className="w-5 h-5" />
            Start Session
          </button>
        </div>
      )}

      {/* Exercise List */}
      {sessionStarted && (
        <div className="space-y-4">
          {exercises.map((exercise, index) => {
            const isExpanded = expandedExercise === exercise.id
            const isComplete = completedExercises.has(exercise.id)
            const suggested = calculateSuggestedWeight(
              exercise.exercise_name,
              exercise.exercise_sets[0]?.intensity_type || '',
              exercise.exercise_sets[0]?.intensity_value || ''
            )

            return (
              <div 
                key={exercise.id} 
                className={`card overflow-hidden transition-all ${isComplete ? 'opacity-60' : ''}`}
              >
                {/* Exercise Header */}
                <button
                  onClick={() => setExpandedExercise(isExpanded ? null : exercise.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      isComplete 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-yellow-400/10 text-yellow-400'
                    }`}>
                      {isComplete ? <Check className="w-4 h-4" /> : index + 1}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-foreground">{exercise.exercise_name}</p>
                      <p className="text-xs text-zinc-500">
                        {exercise.exercise_sets.length} sets
                        {suggested && ` • Suggested: ${suggested}kg`}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-zinc-400" />
                  )}
                </button>

                {/* Sets */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="space-y-3 mt-4">
                      {exercise.exercise_sets.map((set) => {
                        const key = getSetKey(exercise.id, set.set_number)
                        const log = setLogs.get(key) || { set_number: set.set_number, weight_kg: null, reps_completed: null }
                        
                        return (
                          <div key={set.id} className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl p-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-300 dark:bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-600 dark:text-zinc-400">
                              {set.set_number}
                            </div>
                            
                            <div className="flex-1 grid grid-cols-2 gap-3">
                              {/* Weight Input */}
                              <div>
                                <label className="text-[10px] text-zinc-500 uppercase">Weight (kg)</label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.5"
                                  placeholder={suggested?.toString() || '0'}
                                  value={log.weight_kg ?? ''}
                                  onChange={(e) => updateSetLog(exercise.id, set.set_number, 'weight_kg', e.target.value ? parseFloat(e.target.value) : null)}
                                  onBlur={(e) => autoFillSubsequentSets(exercise.id, set.set_number, 'weight_kg', e.target.value ? parseFloat(e.target.value) : null, exercise.exercise_sets.length)}
                                  className="w-full mt-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-foreground text-center font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                />
                                {lastWeights.get(`${exercise.id}-${set.set_number}`) && (
                                  <p className="text-[10px] text-zinc-500 text-center mt-1">
                                    Last: {lastWeights.get(`${exercise.id}-${set.set_number}`)}kg
                                  </p>
                                )}
                              </div>
                              
                              {/* Reps Input */}
                              <div>
                                <label className="text-[10px] text-zinc-500 uppercase">Reps (target: {set.reps})</label>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  placeholder={set.reps}
                                  value={log.reps_completed ?? ''}
                                  onChange={(e) => updateSetLog(exercise.id, set.set_number, 'reps_completed', e.target.value ? parseInt(e.target.value) : null)}
                                  onBlur={(e) => autoFillSubsequentSets(exercise.id, set.set_number, 'reps_completed', e.target.value ? parseInt(e.target.value) : null, exercise.exercise_sets.length)}
                                  className="w-full mt-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-foreground text-center font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                />
                              </div>
                            </div>

                            {/* Set info */}
                            <div className="text-right text-xs text-zinc-500 w-20">
                              {set.intensity_type === 'percentage' && `${set.intensity_value}%`}
                              {set.intensity_type === 'rpe' && `RPE ${set.intensity_value}`}
                              {set.intensity_type === 'rir' && `RIR ${set.intensity_value}`}
                              {set.intensity_type === 'time' && `${set.intensity_value}s`}
                              {set.intensity_type === 'failure' && 'To Failure'}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Mark Complete Button */}
                    {!isComplete && (
                      <button
                        onClick={() => markExerciseComplete(exercise.id)}
                        className="w-full mt-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Mark Exercise Complete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Session Notes */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-yellow-400" />
                <label className="text-sm font-medium text-foreground">Session Notes</label>
              </div>
              {lastSaved && (
                <span className="text-xs text-zinc-500">
                  Auto-saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
            <textarea
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="Add notes throughout the session..."
              rows={3}
              className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-foreground placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
            />
          </div>

          {/* Complete Session Button */}
          <button
            onClick={completeSession}
            disabled={saving || completedExercises.size === 0}
            className="w-full py-4 bg-green-500 hover:bg-green-600 disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5" />
                Complete Session ({completedExercises.size}/{exercises.length} exercises)
              </>
            )}
          </button>
        </div>
      )}

      {/* Calendar History Modal */}
      {showCalendar && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => { setShowCalendar(false); setSelectedHistoryDate(null); setHistoryDetails(null) }}>
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-lg max-h-[85vh] overflow-hidden mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div>
                <h3 className="text-lg font-semibold text-white">Workout History</h3>
                <p className="text-sm text-zinc-400">{clientName}</p>
              </div>
              <button onClick={() => { setShowCalendar(false); setSelectedHistoryDate(null); setHistoryDetails(null) }} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
              {selectedHistoryDate ? (
                // Workout Details View
                <div>
                  <button
                    onClick={() => { setSelectedHistoryDate(null); setHistoryDetails(null) }}
                    className="flex items-center gap-2 text-yellow-400 text-sm mb-4 hover:text-yellow-300"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back to calendar
                  </button>
                  
                  <h4 className="font-semibold text-white mb-2">
                    {selectedHistoryDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </h4>
                  
                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
                    </div>
                  ) : historyDetails ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-zinc-400 text-sm">{historyDetails.workout_name}</p>
                        {historyDetails.scheduled && (
                          <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-lg">
                            Not completed
                          </span>
                        )}
                      </div>
                      
                      {historyDetails.program_name && (
                        <p className="text-zinc-500 text-xs">{historyDetails.program_name}</p>
                      )}
                      
                      {historyDetails.notes && (
                        <div className="p-3 bg-zinc-800/50 rounded-xl">
                          <p className="text-xs text-zinc-500 mb-1">Session Notes</p>
                          <p className="text-sm text-zinc-300">{historyDetails.notes}</p>
                        </div>
                      )}
                      
                      {historyDetails.sets && historyDetails.sets.length > 0 ? (
                        (() => {
                          const groups = historyDetails.sets.reduce((acc: any, s: any) => {
                            if (!acc[s.exercise_name]) acc[s.exercise_name] = []
                            acc[s.exercise_name].push(s)
                            return acc
                          }, {} as Record<string, any[]>)
                          
                          return Object.entries(groups).map(([name, sets]) => (
                            <div key={name} className="bg-zinc-800/30 rounded-xl p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Dumbbell className="w-4 h-4 text-yellow-400" />
                                <h4 className="font-medium text-white">{name}</h4>
                              </div>
                              <div className="space-y-1">
                                {(sets as any[]).map((s: any) => (
                                  <div key={s.set_number} className="flex justify-between text-sm">
                                    <span className="text-zinc-500">Set {s.set_number}</span>
                                    <span className="text-white font-medium">
                                      {s.weight_kg !== null ? `${s.weight_kg}kg` : '—'} × {s.reps_completed ?? '—'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        })()
                      ) : (
                        <p className="text-zinc-500 text-center py-4">
                          {historyDetails.scheduled ? 'Workout not yet completed' : 'No set data recorded'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-center py-8">No workout scheduled for this date</p>
                  )}
                </div>
              ) : (
                // Calendar View
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-zinc-400">
                      {calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </h4>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4 text-zinc-400" />
                      </button>
                      <button
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                      >
                        <ChevronRight className="w-4 h-4 text-zinc-400" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {daysOfWeek.map(day => (
                        <div key={day} className="text-center text-zinc-500 text-xs font-medium py-1">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1">
                      {getCalendarDays().map((date, idx) => {
                        if (!date) {
                          return <div key={`empty-${idx}`} className="aspect-square" />
                        }
                        
                        const today = new Date()
                        const isToday = date.toDateString() === today.toDateString()
                        const status = getDateStatus(date)
                        const hasWorkout = scheduleByDay[date.getDay()]
                        
                        return (
                          <div
                            key={date.toISOString()}
                            onClick={() => hasWorkout && fetchHistoryDetails(date)}
                            className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all ${
                              hasWorkout
                                ? `${getStatusColor(status)} cursor-pointer hover:ring-2 hover:ring-white/30`
                                : 'text-zinc-600'
                            } ${hasWorkout ? 'border' : ''} ${isToday ? 'font-bold ring-2 ring-yellow-400' : ''}`}
                          >
                            <span className={isToday ? 'text-yellow-400' : ''}>{date.getDate()}</span>
                          </div>
                        )
                      })}
                    </div>
                    
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
                    </div>
                    <p className="text-center text-zinc-500 text-xs mt-2">Click any workout day to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
