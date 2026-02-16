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

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  
  // Get user's active AND future programs with workouts (including week_number)
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

  // Get workout completions for the lookback period
  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - COMPLETION_LOOKBACK_DAYS)
  
  const { data: completions } = await supabase
    .from('workout_completions')
    .select('workout_id, scheduled_date, completed_at, client_program_id')
    .eq('client_id', user.id)
    .gte('scheduled_date', lookbackDate.toISOString().split('T')[0])

  // Build schedule data organized by week and day
  interface WorkoutSchedule {
    dayOfWeek: number
    workoutId: string
    workoutName: string
    programName: string
    programCategory: string
    clientProgramId: string
    weekNumber: number
  }

  // Structure: scheduleByWeekAndDay[weekNumber][dayOfWeek] = workouts[]
  const scheduleByWeekAndDay: Record<number, Record<number, WorkoutSchedule[]>> = {}
  let programStartDate: string | undefined
  let maxWeek = 1
  
  // First pass: collect workout data and determine maxWeek
  const workoutDataList: { weekNum: number; dayOfWeek: number; data: WorkoutSchedule }[] = []
  
  if (clientPrograms) {
    // Get earliest start date from active programs
    const activePrograms = clientPrograms.filter(cp => cp.is_active)
    if (activePrograms.length > 0) {
      programStartDate = activePrograms.reduce((earliest, cp) => 
        cp.start_date < earliest ? cp.start_date : earliest, 
        activePrograms[0].start_date
      )
    }
    
    for (const cp of clientPrograms) {
      if (!cp.is_active) continue // Only process active programs
      
      const programData = cp.programs as unknown
      const program = (Array.isArray(programData) ? programData[0] : programData) as {
        id: string
        name: string
        category?: string
        program_workouts?: { id: string; name: string; day_of_week: number | null; parent_workout_id: string | null; week_number: number | null }[]
      } | null
      
      if (program?.program_workouts) {
        for (const workout of program.program_workouts) {
          // Skip finisher workouts
          if (workout.parent_workout_id) continue
          
          if (workout.day_of_week !== null) {
            const weekNum = workout.week_number || 1
            maxWeek = Math.max(maxWeek, weekNum)
            
            workoutDataList.push({
              weekNum,
              dayOfWeek: workout.day_of_week,
              data: {
                dayOfWeek: workout.day_of_week,
                workoutId: workout.id,
                workoutName: workout.name,
                programName: program.name,
                programCategory: program.category || 'strength',
                clientProgramId: cp.id,
                weekNumber: weekNum
              }
            })
          }
        }
      }
    }
  }
  
  // Initialize ALL weeks from 1 to maxWeek with empty arrays for all 7 days
  // This ensures rest days are properly represented as empty arrays
  for (let w = 1; w <= maxWeek; w++) {
    scheduleByWeekAndDay[w] = {}
    for (let d = 0; d < 7; d++) {
      scheduleByWeekAndDay[w][d] = []
    }
  }
  
  // Now populate with actual workout data
  for (const { weekNum, dayOfWeek, data } of workoutDataList) {
    scheduleByWeekAndDay[weekNum][dayOfWeek].push(data)
  }

  // Legacy scheduleByDay (uses week 1) for backward compatibility
  const scheduleByDay: Record<number, WorkoutSchedule[]> = scheduleByWeekAndDay[1] || {}

  // Format completions
  const completedWorkouts: Record<string, boolean> = {}
  completions?.forEach(c => {
    const keyWithProgram = `${c.scheduled_date}:${c.workout_id}:${c.client_program_id}`
    completedWorkouts[keyWithProgram] = true
    const keyWithoutProgram = `${c.scheduled_date}:${c.workout_id}`
    completedWorkouts[keyWithoutProgram] = true
    const keyDateOnly = `${c.scheduled_date}:any`
    completedWorkouts[keyDateOnly] = true
  })

  // Separate future programs for display
  const futurePrograms = clientPrograms?.filter(cp => !cp.is_active && cp.start_date > todayStr) || []
  
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
        scheduleByWeekAndDay={scheduleByWeekAndDay}
        completedWorkouts={completedWorkouts}
        upcomingPrograms={upcomingPrograms}
        programStartDate={programStartDate}
        maxWeek={maxWeek}
      />
      <BottomNav />
    </div>
  )
}
