import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { COMPLETION_LOOKBACK_DAYS } from '@/app/lib/constants'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    const adminClient = getAdminClient()
    
    // Get user's active programs with workouts (including week_number and start_date)
    const { data: clientPrograms } = await adminClient
      .from('client_programs')
      .select(`
        id,
        program_id,
        start_date,
        duration_weeks,
        programs (
          id,
          name,
          program_workouts (
            id,
            name,
            day_of_week,
            week_number,
            parent_workout_id
          )
        )
      `)
      .eq('client_id', userId)
      .eq('is_active', true)

    // Get active client program IDs
    const activeClientProgramIds = clientPrograms?.map(cp => cp.id) || []

    // Get workout completions for the lookback period
    const lookbackDate = new Date()
    lookbackDate.setDate(lookbackDate.getDate() - COMPLETION_LOOKBACK_DAYS)
    
    let completionsQuery = adminClient
      .from('workout_completions')
      .select('workout_id, scheduled_date, client_program_id')
      .eq('client_id', userId)
      .gte('scheduled_date', lookbackDate.toISOString().split('T')[0])
    
    if (activeClientProgramIds.length > 0) {
      completionsQuery = completionsQuery.in('client_program_id', activeClientProgramIds)
    }
    
    const { data: completions } = await completionsQuery

    // Build schedule data organized by week AND day
    // Structure: scheduleByWeekAndDay[weekNumber][dayOfWeek] = WorkoutSchedule[] (ARRAY)
    interface WorkoutSchedule {
      dayOfWeek: number
      workoutId: string
      workoutName: string
      programName: string
      clientProgramId: string
      weekNumber: number
    }

    const scheduleByWeekAndDay: Record<number, Record<number, WorkoutSchedule[]>> = {}
    let programStartDate: string | null = null
    let maxWeek = 1
    
    if (clientPrograms && clientPrograms.length > 0) {
      // Use the first active program's start date
      programStartDate = clientPrograms[0].start_date
      
      for (const cp of clientPrograms) {
        const programData = cp.programs as unknown
        const program = (Array.isArray(programData) ? programData[0] : programData) as {
          id: string
          name: string
          program_workouts?: { id: string; name: string; day_of_week: number | null; week_number: number | null; parent_workout_id: string | null }[]
        } | null
        
        if (program?.program_workouts) {
          for (const workout of program.program_workouts) {
            // Skip finishers
            if (workout.parent_workout_id) continue
            
            if (workout.day_of_week !== null) {
              const weekNum = workout.week_number || 1
              maxWeek = Math.max(maxWeek, weekNum)
              
              if (!scheduleByWeekAndDay[weekNum]) {
                scheduleByWeekAndDay[weekNum] = {}
              }
              
              if (!scheduleByWeekAndDay[weekNum][workout.day_of_week]) {
                scheduleByWeekAndDay[weekNum][workout.day_of_week] = []
              }
              
              scheduleByWeekAndDay[weekNum][workout.day_of_week].push({
                dayOfWeek: workout.day_of_week,
                workoutId: workout.id,
                workoutName: workout.name,
                programName: program.name,
                clientProgramId: cp.id,
                weekNumber: weekNum
              })
            }
          }
        }
      }
    }

    // Format completions with STRICT date matching
    // Key format: "YYYY-MM-DD:workoutId:clientProgramId" for exact match
    const completionsByDate: Record<string, string> = {}
    const completionsByDateAndWorkout: Record<string, boolean> = {}
    
    completions?.forEach(c => {
      // Legacy format (just date -> workoutId)
      completionsByDate[c.scheduled_date] = c.workout_id
      
      // Primary: exact match with date, workout, and program
      const keyWithProgram = `${c.scheduled_date}:${c.workout_id}:${c.client_program_id}`
      completionsByDateAndWorkout[keyWithProgram] = true
      
      // Fallback for old completions without client_program_id
      if (!c.client_program_id) {
        completionsByDateAndWorkout[`${c.scheduled_date}:${c.workout_id}`] = true
      }
    })

    // Also return legacy scheduleByDay for backward compatibility (uses week 1, first workout per day)
    const scheduleByDay: Record<number, WorkoutSchedule> = {}
    const week1 = scheduleByWeekAndDay[1] || {}
    for (const [day, workouts] of Object.entries(week1)) {
      if (workouts.length > 0) {
        scheduleByDay[Number(day)] = workouts[0]
      }
    }

    return NextResponse.json({ 
      scheduleByDay, // Legacy: week 1 only
      scheduleByWeekAndDay, // New: all weeks
      completionsByDate, // Legacy: date -> workoutId
      completionsByDateAndWorkout, // New: strict date+workout+program matching
      programStartDate,
      maxWeek
    })
  } catch (error) {
    console.error('Schedule fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}
