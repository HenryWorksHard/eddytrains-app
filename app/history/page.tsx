import { redirect } from 'next/navigation'
import { createClient } from '../lib/supabase/server'
import HistoryClient from './HistoryClient'
import BottomNav from '../components/BottomNav'
import PageHeader from '../components/PageHeader'

export default async function HistoryPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get workout history with exercise details
  const { data: workoutLogs } = await supabase
    .from('workout_logs')
    .select(`
      id,
      workout_id,
      completed_at,
      workouts (
        id,
        name,
        programs (
          id,
          name,
          category
        )
      )
    `)
    .eq('client_id', user.id)
    .order('completed_at', { ascending: false })
    .limit(50)

  // Get set logs for each workout
  const workoutLogIds = workoutLogs?.map(log => log.id) || []
  
  const { data: setLogs } = await supabase
    .from('set_logs')
    .select(`
      id,
      workout_log_id,
      exercise_id,
      set_number,
      weight_kg,
      reps_completed
    `)
    .in('workout_log_id', workoutLogIds)

  // Get exercise names
  const exerciseIds = [...new Set(setLogs?.map(log => log.exercise_id) || [])]
  
  const { data: exercises } = await supabase
    .from('workout_exercises')
    .select('id, exercise_name')
    .in('id', exerciseIds)

  // Build exercise lookup
  const exerciseLookup = new Map(exercises?.map(e => [e.id, e.exercise_name]) || [])

  // Transform data for client
  const history = workoutLogs?.map(log => {
    const workout = log.workouts as unknown as { id: string; name: string; programs: { id: string; name: string; category: string } | null } | null
    const workoutSetLogs = setLogs?.filter(sl => sl.workout_log_id === log.id) || []
    
    // Group by exercise
    const exerciseMap = new Map<string, { name: string; sets: { set: number; weight: number; reps: number }[] }>()
    
    workoutSetLogs.forEach(sl => {
      const exerciseName = exerciseLookup.get(sl.exercise_id) || 'Unknown Exercise'
      if (!exerciseMap.has(sl.exercise_id)) {
        exerciseMap.set(sl.exercise_id, { name: exerciseName, sets: [] })
      }
      exerciseMap.get(sl.exercise_id)!.sets.push({
        set: sl.set_number,
        weight: sl.weight_kg || 0,
        reps: sl.reps_completed || 0
      })
    })

    // Sort sets within each exercise
    exerciseMap.forEach(ex => {
      ex.sets.sort((a, b) => a.set - b.set)
    })

    return {
      id: log.id,
      date: log.completed_at,
      workoutName: workout?.name || 'Workout',
      programName: workout?.programs?.name || '',
      category: workout?.programs?.category || 'strength',
      exercises: Array.from(exerciseMap.values())
    }
  }) || []

  return (
    <div className="min-h-screen bg-black pb-20">
      <PageHeader title="History" />

      <HistoryClient history={history} />
      <BottomNav />
    </div>
  )
}
