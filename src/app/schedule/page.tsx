import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '../components/BottomNav'
import ScheduleClient from './ScheduleClient'
import { COMPLETION_LOOKBACK_DAYS } from '../lib/constants'

// Force dynamic rendering - no caching
export const revalidate = 60

export default async function SchedulePage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user's active AND future programs with workouts (including week_number)
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  
  const { data: clientPrograms } = await supabase
    .from('client_programs')
    .select(`
      id,
      program_id,
      start_date,
      end_date,
      duration_weeks,
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
          parent_workout_id,
          week_number
        )
      )
    `)
    .eq('client_id', user.id)
    .or(`is_active.eq.true,start_date.gt.${todayStr}`)
    .order('start_date', { ascending: true })

  // Get active client program IDs
  const activeClientProgramIds = clientPrograms?.map(cp => cp.id) || []

  // Get workout completions for the lookback period
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
      // Only process active programs for schedule
      if (!cp.is_active) continue
      
      const programData = cp.programs as unknown
      const program = (Array.isArray(programData) ? programData[0] : programData) as {
        id: string
        name: string
        category?: string
        program_workouts?: { id: string; name: string; day_of_week: number | null; parent_workout_id: string | null; week_number: number | null }[]
      } | null
      
      if (program?.program_workouts) {
        // Calculate which week of the program we're currently in
        const startDate = new Date(cp.start_date)
        startDate.setHours(0, 0, 0, 0)
        const todayMidnight = new Date(today)
        todayMidnight.setHours(0, 0, 0, 0)
        
        const daysSinceStart = Math.floor((todayMidnight.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        const currentWeek = Math.floor(daysSinceStart / 7) + 1
        
        // Find max week in program
        const maxWeekInProgram = Math.max(...program.program_workouts.map(w => w.week_number || 1))
        const durationWeeks = cp.duration_weeks || maxWeekInProgram
        
        // Determine effective week
        let effectiveWeek: number
        if (daysSinceStart < 0) {
          effectiveWeek = 1
        } else if (currentWeek > durationWeeks) {
          effectiveWeek = maxWeekInProgram
        } else {
          effectiveWeek = Math.min(currentWeek, maxWeekInProgram)
        }
        
        for (const workout of program.program_workouts) {
          // Skip finisher workouts (they have parent_workout_id set)
          if (workout.parent_workout_id) continue
          
          // Only include workouts for the current week
          const workoutWeek = workout.week_number || 1
          if (workoutWeek !== effectiveWeek) continue
          
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
  const completedWorkouts: Record<string, boolean> = {}
  completions?.forEach(c => {
    const keyWithProgram = `${c.scheduled_date}:${c.workout_id}:${c.client_program_id}`
    completedWorkouts[keyWithProgram] = true
    const keyWithoutProgram = `${c.scheduled_date}:${c.workout_id}`
    completedWorkouts[keyWithoutProgram] = true
    const keyDateOnly = `${c.scheduled_date}:any`
    completedWorkouts[keyDateOnly] = true
  })

  // Separate current/active programs from future programs
  const activePrograms = clientPrograms?.filter(cp => cp.is_active) || []
  const futurePrograms = clientPrograms?.filter(cp => !cp.is_active && cp.start_date > todayStr) || []
  
  // Get earliest active program start date
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
