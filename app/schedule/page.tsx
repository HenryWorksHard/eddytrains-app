import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '../components/BottomNav'
import ScheduleClient from './ScheduleClient'
import { COMPLETION_LOOKBACK_DAYS } from '../lib/constants'

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic'

export default async function SchedulePage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user's active AND future programs with workouts
  const today = new Date().toISOString().split('T')[0]
  const { data: clientPrograms } = await supabase
    .from('client_programs')
    .select(`
      id,
      program_id,
      start_date,
      end_date,
      is_active,
      phase_name,
      programs (
        id,
        name,
        category,
        program_workouts (
          id,
          name,
          day_of_week,
          order_index
        )
      )
    `)
    .eq('client_id', user.id)
    .or(`is_active.eq.true,start_date.gt.${today}`)
    .order('start_date', { ascending: true })

  // Get active client program IDs
  const activeClientProgramIds = clientPrograms?.map(cp => cp.id) || []

  // Get workout completions for the lookback period, filtered by active program assignments
  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - COMPLETION_LOOKBACK_DAYS)
  
  let completionsQuery = supabase
    .from('workout_completions')
    .select('workout_id, scheduled_date, completed_at, client_program_id')
    .eq('client_id', user.id)
    .gte('scheduled_date', lookbackDate.toISOString().split('T')[0])
  
  // Only show completions for current active program assignments
  if (activeClientProgramIds.length > 0) {
    completionsQuery = completionsQuery.in('client_program_id', activeClientProgramIds)
  }
  
  const { data: completions } = await completionsQuery

  // Build schedule data - supports multiple workouts per day
  interface WorkoutSchedule {
    dayOfWeek: number
    workoutId: string
    workoutName: string
    programName: string
    programCategory: string
    clientProgramId: string
  }

  const scheduleByDay: Record<number, WorkoutSchedule[]> = {}
  
  // Initialize all days with empty arrays
  for (let i = 0; i < 7; i++) {
    scheduleByDay[i] = []
  }
  
  if (clientPrograms) {
    for (const cp of clientPrograms) {
      const programData = cp.programs as unknown
      const program = (Array.isArray(programData) ? programData[0] : programData) as {
        id: string
        name: string
        category?: string
        program_workouts?: { id: string; name: string; day_of_week: number | null }[]
      } | null
      
      if (program?.program_workouts) {
        for (const workout of program.program_workouts) {
          if (workout.day_of_week !== null) {
            scheduleByDay[workout.day_of_week].push({
              dayOfWeek: workout.day_of_week,
              workoutId: workout.id,
              workoutName: workout.name,
              programName: program.name,
              programCategory: program.category || 'strength',
              clientProgramId: cp.id
            })
          }
        }
      }
    }
  }

  // Format completions for client - supports multiple completions per date
  // Key format: "date:workoutId:clientProgramId" to track each workout separately
  const completedWorkouts: Record<string, boolean> = {}
  completions?.forEach(c => {
    const key = `${c.scheduled_date}:${c.workout_id}:${c.client_program_id}`
    completedWorkouts[key] = true
  })

  // Separate current/active programs from future programs
  const activePrograms = clientPrograms?.filter(cp => cp.is_active) || []
  const futurePrograms = clientPrograms?.filter(cp => !cp.is_active && cp.start_date > today) || []

  // Format future programs for display
  const upcomingPrograms = futurePrograms.map(cp => {
    const programData = cp.programs as any
    const program = Array.isArray(programData) ? programData[0] : programData
    return {
      id: cp.id,
      programId: cp.program_id,
      programName: program?.name || 'Unknown',
      programCategory: program?.category || 'strength',
      startDate: cp.start_date,
      endDate: cp.end_date,
      phaseName: cp.phase_name,
    }
  })

  return (
    <div className="min-h-screen bg-black pb-24">
      <ScheduleClient 
        scheduleByDay={scheduleByDay}
        completedWorkouts={completedWorkouts}
        upcomingPrograms={upcomingPrograms}
      />
      <BottomNav />
    </div>
  )
}
