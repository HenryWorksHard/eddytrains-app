import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '../components/BottomNav'
import Link from 'next/link'
import DashboardClient from './DashboardClient'

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

  // Transform programs data for client component
  const workoutsByDay: Record<number, { id: string; name: string; programName: string; clientProgramId: string; exerciseCount: number }> = {}
  
  if (userPrograms) {
    for (const up of userPrograms) {
      const programData = up.programs as unknown
      const program = (Array.isArray(programData) ? programData[0] : programData) as { 
        id: string
        name: string
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
            workoutsByDay[workout.day_of_week] = {
              id: workout.id,
              name: workout.name,
              programName: program.name,
              clientProgramId: up.id,
              exerciseCount: workout.workout_exercises?.length || 0
            }
          }
        }
      }
    }
  }

  const firstName = profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'there'
  const programCount = userPrograms?.length || 0

  return (
    <div className="min-h-screen bg-black pb-32">
      <DashboardClient 
        firstName={firstName}
        workoutsByDay={workoutsByDay}
        programCount={programCount}
      />
      <BottomNav />
    </div>
  )
}
