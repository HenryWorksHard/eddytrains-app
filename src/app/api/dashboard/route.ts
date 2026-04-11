import { createClient } from '../../lib/supabase/server'
import { formatDateToString } from '../../lib/dateUtils'
import { NextRequest, NextResponse } from 'next/server'

// How many months of history to load for the calendar.
// 365 days of completions is a tiny payload and gives users a full year
// of history to scroll back through.
const CALENDAR_HISTORY_MONTHS = 12

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Prefer the client-supplied local date (?today=YYYY-MM-DD) so that
  // "today" and the calendar window are anchored to the user's timezone,
  // not the server's (Vercel = UTC). Fall back to server-local if missing
  // or malformed.
  const { searchParams } = new URL(request.url)
  const todayParam = searchParams.get('today')
  const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(todayParam || '')
    ? todayParam!
    : formatDateToString(new Date())

  // Build the calendar window anchored on todayStr. Parse as local so we
  // don't re-introduce a UTC shift.
  const [ty, tm] = todayStr.split('-').map(Number)
  const windowStart = formatDateToString(
    new Date(ty, tm - 1 - (CALENDAR_HISTORY_MONTHS - 1), 1)
  )
  // Day 0 of next month = last day of the current month
  const windowEnd = formatDateToString(new Date(ty, tm, 0))

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
        start_date,
        duration_weeks,
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
            week_number,
            workout_exercises (id)
          )
        )
      `)
      .eq('client_id', user.id)
      .eq('is_active', true),
    
    // "Today's" completions — used to strike through today's scheduled
    // workouts on the home screen. Match by scheduled_date (the local day
    // the workout was assigned to), NOT completed_at (UTC timestamp of
    // when the user tapped complete, which can be a different day).
    supabase
      .from('workout_completions')
      .select('workout_id, client_program_id, scheduled_date')
      .eq('client_id', user.id)
      .eq('scheduled_date', todayStr),

    // Calendar completions — 12 months of history for the monthly
    // calendar view, keyed by scheduled_date so catch-up workouts land
    // on the day they were scheduled for, not the day they were logged.
    supabase
      .from('workout_completions')
      .select('workout_id, client_program_id, scheduled_date')
      .eq('client_id', user.id)
      .gte('scheduled_date', windowStart)
      .lte('scheduled_date', windowEnd),
    
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

  // Build schedule data by week and day
  interface WorkoutData {
    dayOfWeek: number
    workoutId: string
    workoutName: string
    programName: string
    programCategory: string
    clientProgramId: string
    exerciseCount: number
    weekNumber: number
  }

  const scheduleByWeekAndDay: Record<number, Record<number, WorkoutData[]>> = {}
  let maxWeek = 1
  
  // Initialize week 1
  scheduleByWeekAndDay[1] = {}
  for (let i = 0; i < 7; i++) {
    scheduleByWeekAndDay[1][i] = []
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
          week_number?: number | null
          workout_exercises?: { id: string }[]
        }[] 
      } | null
      
      if (program?.program_workouts) {
        for (const workout of program.program_workouts) {
          if (workout.parent_workout_id) continue
          
          if (workout.day_of_week !== null) {
            const weekNum = workout.week_number || 1
            maxWeek = Math.max(maxWeek, weekNum)
            
            if (!scheduleByWeekAndDay[weekNum]) {
              scheduleByWeekAndDay[weekNum] = {}
              for (let i = 0; i < 7; i++) {
                scheduleByWeekAndDay[weekNum][i] = []
              }
            }
            
            scheduleByWeekAndDay[weekNum][workout.day_of_week].push({
              dayOfWeek: workout.day_of_week,
              workoutId: workout.id,
              workoutName: workout.name,
              programName: program.name,
              programCategory: program.category || 'strength',
              clientProgramId: up.id,
              exerciseCount: workout.workout_exercises?.length || 0,
              weekNumber: weekNum
            })
          }
        }
      }
    }
  }

  // Legacy workoutsByDay uses week 1
  const workoutsByDay: Record<number, WorkoutData[]> = scheduleByWeekAndDay[1] || {}

  // Build completed workouts set
  const completedWorkoutIds: Set<string> = new Set()
  todayCompletions?.forEach(c => {
    completedWorkoutIds.add(`${c.workout_id}:${c.client_program_id}`)
  })
  const completedWorkoutsArray = Array.from(completedWorkoutIds)

  // Build calendar completions map keyed by scheduled_date.
  // This is the local calendar day the workout was assigned to — it
  // stays stable whether the client finished on time or caught up later.
  const calendarCompletions: Record<string, boolean> = {}
  monthCompletions?.forEach(c => {
    const d = c.scheduled_date
    if (!d) return
    calendarCompletions[`${d}:${c.workout_id}:${c.client_program_id}`] = true
    calendarCompletions[`${d}:${c.workout_id}`] = true
    calendarCompletions[`${d}:any`] = true
  })

  // Schedule by day for calendar (with week info)
  const scheduleByDay: Record<number, { dayOfWeek: number; workoutId: string; workoutName: string; programName: string; programCategory: string; clientProgramId: string }[]> = {}
  for (let i = 0; i < 7; i++) {
    scheduleByDay[i] = (workoutsByDay[i] || []).map(w => ({
      dayOfWeek: i,
      workoutId: w.workoutId,
      workoutName: w.workoutName,
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
    scheduleByWeekAndDay,
    programCount,
    completedWorkouts: completedWorkoutsArray,
    scheduleByDay,
    calendarCompletions,
    programStartDate,
    maxWeek
  })
}
