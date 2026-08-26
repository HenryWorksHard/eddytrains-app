import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '../components/BottomNav'
import OneRMClient from './OneRMClient'
import { estimateOneRm } from '../lib/tonnage'

export default async function OneRMPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch 1RMs
  const { data: oneRMs } = await supabase
    .from('client_1rms')
    .select('*')
    .eq('client_id', user.id)

  // Fetch workout logs with set data for progress history.
  // Audit fix (2026-08-26): order DESC so heavy users (100+ sessions)
  // get their MOST RECENT 100, not the oldest 100 (which froze charts
  // months in the past). The chart re-sorts ascending for display.
  const { data: workoutLogs } = await supabase
    .from('workout_logs')
    .select(`
      id,
      completed_at
    `)
    .eq('client_id', user.id)
    .order('completed_at', { ascending: false })
    .limit(100)

  const workoutLogIds = workoutLogs?.map(log => log.id) || []
  
  // Get set logs (exercise_name = save-time snapshot; survives trainer
  // program edits that null out exercise_id — cascade fix 2026-08-26)
  const { data: setLogs } = await supabase
    .from('set_logs')
    .select(`
      workout_log_id,
      exercise_id,
      weight_kg,
      reps_completed,
      exercise_name,
      swapped_exercise_name
    `)
    .in('workout_log_id', workoutLogIds)
    .not('weight_kg', 'is', null)
    .not('reps_completed', 'is', null)

  // Get exercise names for rows whose template still exists
  const exerciseIds = [...new Set((setLogs?.map(log => log.exercise_id) || []).filter(Boolean))]

  const { data: exercises } = exerciseIds.length > 0
    ? await supabase
        .from('workout_exercises')
        .select('id, exercise_name')
        .in('id', exerciseIds)
    : { data: [] as { id: string; exercise_name: string }[] }

  // Build exercise lookup
  const exerciseLookup = new Map(exercises?.map(e => [e.id, e.exercise_name]) || [])

  // Build workout date lookup
  const workoutDateLookup = new Map(workoutLogs?.map(w => [w.id, w.completed_at]) || [])

  // Calculate estimated 1RM for each set using Epley formula: 1RM = weight * (1 + reps/30)
  // Then group by exercise and date to get max estimated 1RM per workout
  const progressData: Record<string, { date: string; value: number }[]> = {}

  setLogs?.forEach(log => {
    // Name priority: swapped > snapshot > live template lookup.
    const exerciseName =
      (log as { swapped_exercise_name?: string | null }).swapped_exercise_name ||
      (log as { exercise_name?: string | null }).exercise_name ||
      exerciseLookup.get(log.exercise_id)
    const date = workoutDateLookup.get(log.workout_log_id)
    
    if (!exerciseName || !date || !log.weight_kg || !log.reps_completed) return
    
    // Use shared estimateOneRm — matches /api/progress exactly.
    // Audit fix (2026-08-23): previously each page had its own formula
    // and results differed by ~3% for the same lift.
    const estimated1RM = Math.round(estimateOneRm(log.weight_kg, log.reps_completed))
    
    if (!progressData[exerciseName]) {
      progressData[exerciseName] = []
    }
    
    // Check if we already have data for this date
    const existingIndex = progressData[exerciseName].findIndex(
      d => d.date.split('T')[0] === date.split('T')[0]
    )
    
    if (existingIndex >= 0) {
      // Keep the higher estimated 1RM
      if (estimated1RM > progressData[exerciseName][existingIndex].value) {
        progressData[exerciseName][existingIndex].value = estimated1RM
      }
    } else {
      progressData[exerciseName].push({ date, value: estimated1RM })
    }
  })
  
  // Sort by date
  Object.keys(progressData).forEach(key => {
    progressData[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  })

  return (
    <div className="min-h-screen bg-black pb-nav">
      <OneRMClient initialOneRMs={oneRMs || []} progressData={progressData} />
      <BottomNav />
    </div>
  )
}
