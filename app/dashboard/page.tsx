import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '../components/BottomNav'
import Link from 'next/link'
import DashboardClient from './DashboardClient'

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get user's assigned programs with workouts
  const { data: userPrograms } = await supabase
    .from('client_programs')
    .select(`
      id,
      program_id,
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
          workout_exercises (
            id,
            exercise_name
          )
        )
      )
    `)
    .eq('client_id', user.id)
    .eq('is_active', true)

  // Transform programs data for client component - supports multiple workouts per day
  const workoutsByDay: Record<number, { id: string; name: string; programName: string; programCategory: string; clientProgramId: string; exerciseCount: number }[]> = {}
  
  // Initialize all days with empty arrays
  for (let i = 0; i < 7; i++) {
    workoutsByDay[i] = []
  }
  
  if (userPrograms) {
    for (const up of userPrograms) {
      const programData = up.programs as unknown
      const program = (Array.isArray(programData) ? programData[0] : programData) as { 
        id: string
        name: string
        category?: string
        program_workouts?: { 
          id: string
          name: string
          day_of_week: number | null
          workout_exercises?: { id: string }[]
        }[] 
      } | null
      
      if (program?.program_workouts) {
        for (const workout of program.program_workouts) {
          // Skip finisher workouts (they have parent_workout_id set)
          if ((workout as any).parent_workout_id) continue
          
          if (workout.day_of_week !== null) {
            workoutsByDay[workout.day_of_week].push({
              id: workout.id,
              name: workout.name,
              programName: program.name,
              programCategory: program.category || 'strength',
              clientProgramId: up.id,
              exerciseCount: workout.workout_exercises?.length || 0
            })
          }
        }
      }
    }
  }

  // Check which of today's workouts are completed
  const today = new Date().toISOString().split('T')[0]
  const todayDayOfWeek = new Date().getDay()
  const todayWorkouts = workoutsByDay[todayDayOfWeek] || []
  
  // Get completions for today (for simple today check)
  const completedWorkoutIds: Set<string> = new Set()
  if (todayWorkouts.length > 0) {
    const { data: completions } = await supabase
      .from('workout_completions')
      .select('workout_id, client_program_id')
      .eq('client_id', user.id)
      .eq('scheduled_date', today)
    
    completions?.forEach(c => {
      completedWorkoutIds.add(`${c.workout_id}:${c.client_program_id}`)
    })
  }
  
  // Convert to serializable format
  const completedWorkoutsArray = Array.from(completedWorkoutIds)

  // Get all completions for the current month (for calendar view)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  
  const { data: monthCompletions } = await supabase
    .from('workout_completions')
    .select('workout_id, client_program_id, scheduled_date')
    .eq('client_id', user.id)
    .gte('scheduled_date', monthStart)
    .lte('scheduled_date', monthEnd)
  
  // Build calendar completions map: "date:workoutId:clientProgramId" -> true
  const calendarCompletions: Record<string, boolean> = {}
  monthCompletions?.forEach(c => {
    const key = `${c.scheduled_date}:${c.workout_id}:${c.client_program_id}`
    calendarCompletions[key] = true
  })

  // Transform workoutsByDay to calendar format (needs dayOfWeek, workoutId, etc.)
  const scheduleByDay: Record<number, { dayOfWeek: number; workoutId: string; workoutName: string; programName: string; programCategory: string; clientProgramId: string }[]> = {}
  for (let i = 0; i < 7; i++) {
    scheduleByDay[i] = (workoutsByDay[i] || []).map(w => ({
      dayOfWeek: i,
      workoutId: w.id,
      workoutName: w.name,
      programName: w.programName,
      programCategory: w.programCategory,
      clientProgramId: w.clientProgramId
    }))
  }
  
  // Get earliest active program start date
  const { data: programStartDates } = await supabase
    .from('client_programs')
    .select('start_date')
    .eq('client_id', user.id)
    .eq('is_active', true)
    .order('start_date', { ascending: true })
    .limit(1)
  
  const programStartDate = programStartDates?.[0]?.start_date || undefined

  const firstName = profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'there'
  const programCount = userPrograms?.length || 0

  return (
    <div className="min-h-screen bg-black pb-32">
      <DashboardClient 
        firstName={firstName}
        workoutsByDay={workoutsByDay}
        programCount={programCount}
        completedWorkouts={completedWorkoutsArray}
        scheduleByDay={scheduleByDay}
        calendarCompletions={calendarCompletions}
        programStartDate={programStartDate}
      />
      <BottomNav />
    </div>
  )
}
