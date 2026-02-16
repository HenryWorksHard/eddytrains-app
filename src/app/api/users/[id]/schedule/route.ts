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
    // Structure: scheduleByWeekAndDay[weekNumber][dayOfWeek] = workout
    interface WorkoutSchedule {
      dayOfWeek: number
      workoutId: string
      workoutName: string
      programName: string
      weekNumber: number
    }

    const scheduleByWeekAndDay: Record<number, Record<number, WorkoutSchedule>> = {}
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
              
              scheduleByWeekAndDay[weekNum][workout.day_of_week] = {
                dayOfWeek: workout.day_of_week,
                workoutId: workout.id,
                workoutName: workout.name,
                programName: program.name,
                weekNumber: weekNum
              }
            }
          }
        }
      }
    }

    // Format completions
    const completionsByDate: Record<string, string> = {}
    completions?.forEach(c => {
      completionsByDate[c.scheduled_date] = c.workout_id
    })

    // Also return legacy scheduleByDay for backward compatibility (uses week 1)
    const scheduleByDay: Record<number, WorkoutSchedule> = scheduleByWeekAndDay[1] || {}

    return NextResponse.json({ 
      scheduleByDay, // Legacy: week 1 only
      scheduleByWeekAndDay, // New: all weeks
      completionsByDate,
      programStartDate,
      maxWeek
    })
  } catch (error) {
    console.error('Schedule fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}
