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
            week_number
          )
        )
      `)
      .eq('client_id', userId)
      .eq('is_active', true)

    // Get active client program IDs
    const activeClientProgramIds = clientPrograms?.map(cp => cp.id) || []

    // Get workout completions for the lookback period, filtered by active programs
    const lookbackDate = new Date()
    lookbackDate.setDate(lookbackDate.getDate() - COMPLETION_LOOKBACK_DAYS)
    
    let completionsQuery = adminClient
      .from('workout_completions')
      .select('workout_id, scheduled_date, client_program_id')
      .eq('client_id', userId)
      .gte('scheduled_date', lookbackDate.toISOString().split('T')[0])
    
    // Only show completions for current active program assignments
    if (activeClientProgramIds.length > 0) {
      completionsQuery = completionsQuery.in('client_program_id', activeClientProgramIds)
    }
    
    const { data: completions } = await completionsQuery

    // Build schedule data
    interface WorkoutSchedule {
      dayOfWeek: number
      workoutId: string
      workoutName: string
      programName: string
      weekNumber: number
    }

    const scheduleByDay: Record<number, WorkoutSchedule> = {}
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (clientPrograms) {
      for (const cp of clientPrograms) {
        const programData = cp.programs as unknown
        const program = (Array.isArray(programData) ? programData[0] : programData) as {
          id: string
          name: string
          program_workouts?: { id: string; name: string; day_of_week: number | null; week_number: number | null }[]
        } | null
        
        if (program?.program_workouts) {
          // Calculate which week of the program we're currently in
          const startDate = new Date(cp.start_date)
          startDate.setHours(0, 0, 0, 0)
          
          const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          const currentWeek = Math.floor(daysSinceStart / 7) + 1 // Week 1 is the first week
          
          // Cap to duration_weeks if set, or find the max week in the program
          const maxWeekInProgram = Math.max(...program.program_workouts.map(w => w.week_number || 1))
          const durationWeeks = cp.duration_weeks || maxWeekInProgram
          
          // Determine effective week (loop back to week 1 if past duration, or use current)
          let effectiveWeek: number
          if (daysSinceStart < 0) {
            // Before program start - show week 1
            effectiveWeek = 1
          } else if (currentWeek > durationWeeks) {
            // Past program end - show last week OR loop (for now, show last week)
            effectiveWeek = maxWeekInProgram
          } else {
            // Within program - show current week (capped to available weeks)
            effectiveWeek = Math.min(currentWeek, maxWeekInProgram)
          }
          
          // Filter workouts to only include current week
          for (const workout of program.program_workouts) {
            const workoutWeek = workout.week_number || 1
            
            // Only include workouts for the current week
            if (workoutWeek === effectiveWeek && workout.day_of_week !== null) {
              scheduleByDay[workout.day_of_week] = {
                dayOfWeek: workout.day_of_week,
                workoutId: workout.id,
                workoutName: workout.name,
                programName: program.name,
                weekNumber: workoutWeek
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

    return NextResponse.json({ scheduleByDay, completionsByDate })
  } catch (error) {
    console.error('Schedule fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}
