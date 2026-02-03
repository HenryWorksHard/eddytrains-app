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

  // Get user's active program with workouts
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

  // Get workout completions for the lookback period
  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - COMPLETION_LOOKBACK_DAYS)
  
  const { data: completions } = await supabase
    .from('workout_completions')
    .select('workout_id, scheduled_date, completed_at')
    .eq('client_id', user.id)
    .gte('scheduled_date', lookbackDate.toISOString().split('T')[0])

  // Build schedule data
  interface WorkoutSchedule {
    dayOfWeek: number
    workoutId: string
    workoutName: string
    programName: string
    clientProgramId: string
  }

  const scheduleByDay: Record<number, WorkoutSchedule> = {}
  
  if (clientPrograms) {
    for (const cp of clientPrograms) {
      const programData = cp.programs as unknown
      const program = (Array.isArray(programData) ? programData[0] : programData) as {
        id: string
        name: string
        program_workouts?: { id: string; name: string; day_of_week: number | null }[]
      } | null
      
      if (program?.program_workouts) {
        for (const workout of program.program_workouts) {
          if (workout.day_of_week !== null) {
            scheduleByDay[workout.day_of_week] = {
              dayOfWeek: workout.day_of_week,
              workoutId: workout.id,
              workoutName: workout.name,
              programName: program.name,
              clientProgramId: cp.id
            }
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
