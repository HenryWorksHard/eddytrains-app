import { createClient } from '../../lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  // Run ALL queries in parallel
  const [
    profileResult,
    userProgramsResult,
    todayCompletionsResult,
    monthCompletionsResult,
    programStartResult
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single(),
    
    supabase
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
            workout_exercises (id)
          )
        )
      `)
      .eq('client_id', user.id)
      .eq('is_active', true),
    
    supabase
      .from('workout_completions')
      .select('workout_id, client_program_id')
      .eq('client_id', user.id)
      .eq('scheduled_date', today),
    
    supabase
      .from('workout_completions')
      .select('workout_id, client_program_id, scheduled_date')
      .eq('client_id', user.id)
      .gte('scheduled_date', monthStart)
      .lte('scheduled_date', monthEnd),
    
    supabase
      .from('client_programs')
      .select('start_date')
      .eq('client_id', user.id)
      .eq('is_active', true)
      .order('start_date', { ascending: true })
      .limit(1)
  ])

  const profile = profileResult.data
  const userPrograms = userProgramsResult.data
  const todayCompletions = todayCompletionsResult.data
  const monthCompletions = monthCompletionsResult.data
  const programStartDates = programStartResult.data

  // Transform programs data
  const workoutsByDay: Record<number, { id: string; name: string; programName: string; programCategory: string; clientProgramId: string; exerciseCount: number }[]> = {}
  
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
          parent_workout_id?: string | null
          workout_exercises?: { id: string }[]
        }[] 
      } | null
      
      if (program?.program_workouts) {
        for (const workout of program.program_workouts) {
          if (workout.parent_workout_id) continue
          
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

  // Build completed workouts set
  const completedWorkoutIds: Set<string> = new Set()
  todayCompletions?.forEach(c => {
    completedWorkoutIds.add(`${c.workout_id}:${c.client_program_id}`)
  })
  const completedWorkoutsArray = Array.from(completedWorkoutIds)

  // Build calendar completions map
  const calendarCompletions: Record<string, boolean> = {}
  monthCompletions?.forEach(c => {
    calendarCompletions[`${c.scheduled_date}:${c.workout_id}:${c.client_program_id}`] = true
    calendarCompletions[`${c.scheduled_date}:${c.workout_id}`] = true
    calendarCompletions[`${c.scheduled_date}:any`] = true
  })

  // Schedule by day for calendar
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

  const firstName = profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'there'
  const programCount = userPrograms?.length || 0
  const programStartDate = programStartDates?.[0]?.start_date || undefined

  return NextResponse.json({
    firstName,
    workoutsByDay,
    programCount,
    completedWorkouts: completedWorkoutsArray,
    scheduleByDay,
    calendarCompletions,
    programStartDate
  })
}
