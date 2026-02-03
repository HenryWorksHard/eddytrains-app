import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '../components/BottomNav'
import ScheduleClient from './ScheduleClient'
import { COMPLETION_LOOKBACK_DAYS } from '../lib/constants'

export default async function SchedulePage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user's active programs with workouts (supports multiple programs)
  const { data: clientPrograms } = await supabase
    .from('client_programs')
    .select(`
      id,
      program_id,
      start_date,
      end_date,
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
    .eq('is_active', true)

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

  // Format completions for client
  const completionsByDate: Record<string, string> = {}
  completions?.forEach(c => {
    completionsByDate[c.scheduled_date] = c.workout_id
  })

  return (
    <div className="min-h-screen bg-black pb-24">
      <ScheduleClient 
        scheduleByDay={scheduleByDay}
        completionsByDate={completionsByDate}
      />
      <BottomNav />
    </div>
  )
}
