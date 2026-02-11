import { createClient } from '../../lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function TodayWorkoutPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get today's day of week (0 = Sunday)
  const todayDayOfWeek = new Date().getDay()

  // Get user's active programs with workouts for today
  const today = new Date().toISOString().split('T')[0]
  const { data: clientPrograms } = await supabase
    .from('client_programs')
    .select(`
      id,
      program_id,
      programs (
        id,
        program_workouts (
          id,
          name,
          day_of_week,
          parent_workout_id
        )
      )
    `)
    .eq('client_id', user.id)
    .eq('is_active', true)
    .lte('start_date', today)
    .or(`end_date.gte.${today},end_date.is.null`)
    .order('start_date', { ascending: false })

  // Find today's workout
  let todayWorkout: { id: string; clientProgramId: string } | null = null

  if (clientPrograms) {
    for (const cp of clientPrograms) {
      const program = (Array.isArray(cp.programs) ? cp.programs[0] : cp.programs) as {
        id: string
        program_workouts?: { id: string; name: string; day_of_week: number | null; parent_workout_id: string | null }[]
      } | null

      if (program?.program_workouts) {
        const workout = program.program_workouts.find(
          w => w.day_of_week === todayDayOfWeek && !w.parent_workout_id
        )
        if (workout) {
          todayWorkout = { id: workout.id, clientProgramId: cp.id }
          break
        }
      }
    }
  }

  // Redirect to workout or dashboard if no workout today
  if (todayWorkout) {
    redirect(`/workout/${todayWorkout.id}?clientProgramId=${todayWorkout.clientProgramId}`)
  } else {
    // No workout today - go to dashboard
    redirect('/dashboard')
  }
}
