import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import LogClient from './LogClient'

export const dynamic = 'force-dynamic'

export default async function LogPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user's active programs with workouts
  const { data: clientPrograms } = await supabase
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
          workout_exercises (
            id,
            exercise_name,
            order_index,
            notes,
            superset_group,
            exercise_sets (
              set_number,
              reps,
              intensity_type,
              intensity_value,
              rest_seconds
            )
          )
        )
      )
    `)
    .eq('client_id', user.id)
    .eq('is_active', true)

  // Build schedule by day of week
  interface WorkoutSchedule {
    workoutId: string
    workoutName: string
    programName: string
    programCategory: string
    clientProgramId: string
    exercises: {
      id: string
      name: string
      orderIndex: number
      notes?: string
      supersetGroup?: string
      sets: {
        setNumber: number
        reps: string
        intensityType: string
        intensityValue: string
      }[]
    }[]
  }

  const scheduleByDay: Record<number, WorkoutSchedule[]> = {}
  
  for (let i = 0; i < 7; i++) {
    scheduleByDay[i] = []
  }
  
  if (clientPrograms) {
    for (const cp of clientPrograms) {
      const programData = cp.programs as any
      const program = Array.isArray(programData) ? programData[0] : programData
      
      if (program?.program_workouts) {
        for (const workout of program.program_workouts) {
          if (workout.day_of_week !== null) {
            const exercises = (workout.workout_exercises || [])
              .sort((a: any, b: any) => a.order_index - b.order_index)
              .map((ex: any) => ({
                id: ex.id,
                name: ex.exercise_name,
                orderIndex: ex.order_index,
                notes: ex.notes,
                supersetGroup: ex.superset_group,
                sets: (ex.exercise_sets || [])
                  .sort((a: any, b: any) => a.set_number - b.set_number)
                  .map((s: any) => ({
                    setNumber: s.set_number,
                    reps: s.reps,
                    intensityType: s.intensity_type,
                    intensityValue: s.intensity_value
                  }))
              }))

            scheduleByDay[workout.day_of_week].push({
              workoutId: workout.id,
              workoutName: workout.name,
              programName: program.name,
              programCategory: program.category || 'strength',
              clientProgramId: cp.id,
              exercises
            })
          }
        }
      }
    }
  }

  return <LogClient scheduleByDay={scheduleByDay} />
}
