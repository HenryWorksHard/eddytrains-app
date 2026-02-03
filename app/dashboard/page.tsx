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
  
  // Get completions for today
  const completedWorkoutIds: Set<string> = new Set()
  if (todayWorkouts.length > 0) {
    const { data: completions } = await supabase
      .from('workout_completions')
      .select('workout_id, client_program_id')
      .eq('client_id', user.id)
      .eq('scheduled_date', today)
    
    completions?.forEach(c => {
      // Create a unique key for workout+program combo
      completedWorkoutIds.add(`${c.workout_id}:${c.client_program_id}`)
    })
  }
  
  // Convert to serializable format
  const completedWorkoutsArray = Array.from(completedWorkoutIds)

  const firstName = profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'there'
  const programCount = userPrograms?.length || 0

  return (
    <div className="min-h-screen bg-black pb-32">
      <DashboardClient 
        firstName={firstName}
        workoutsByDay={workoutsByDay}
        programCount={programCount}
        completedWorkouts={completedWorkoutsArray}
      />
      <BottomNav />
    </div>
  )
}
