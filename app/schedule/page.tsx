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
          order_index,
          parent_workout_id
        )
      )
    `)
    .eq('client_id', user.id)
    .or(`is_active.eq.true,start_date.gt.${today}`)
    .order('start_date', { ascending: true })

  // Get active client program IDs
  const activeClientProgramIds = clientPrograms?.map(cp => cp.id) || []

  // Get workout completions for the lookback period
  // Include ALL completions (even from old/null programs) so historical data shows as green
  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - COMPLETION_LOOKBACK_DAYS)
  
  const { data: completions } = await supabase
    .from('workout_completions')
    .select('workout_id, scheduled_date, completed_at, client_program_id')
    .eq('client_id', user.id)
    .gte('scheduled_date', lookbackDate.toISOString().split('T')[0])

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
          // Skip finisher workouts (they have parent_workout_id set)
          if ((workout as any).parent_workout_id) continue
          
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
  // Create multiple key formats for maximum compatibility:
  // 1. Full key with program ID (for exact matching)
  // 2. Key without program ID (for old completions with null program)
  // 3. Date-only key (for any completion on that day - handles program changes)
  const completedWorkouts: Record<string, boolean> = {}
  completions?.forEach(c => {
    // Key with program ID (for current program tracking)
    const keyWithProgram = `${c.scheduled_date}:${c.workout_id}:${c.client_program_id}`
    completedWorkouts[keyWithProgram] = true
    // Key without program ID (for old completions)
    const keyWithoutProgram = `${c.scheduled_date}:${c.workout_id}`
    completedWorkouts[keyWithoutProgram] = true
    // Date-only key (for any completion on that day - handles different workout IDs after program changes)
    const keyDateOnly = `${c.scheduled_date}:any`
    completedWorkouts[keyDateOnly] = true
  })

  // Separate current/active programs from future programs
  const activePrograms = clientPrograms?.filter(cp => cp.is_active) || []
  const futurePrograms = clientPrograms?.filter(cp => !cp.is_active && cp.start_date > today) || []
  
  // Get earliest active program start date (for determining when schedule started)
  const programStartDate = activePrograms.length > 0 
    ? activePrograms.reduce((earliest, cp) => cp.start_date < earliest ? cp.start_date : earliest, activePrograms[0].start_date)
    : undefined

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
        programStartDate={programStartDate}
      />
      <BottomNav />
    </div>
  )
}
