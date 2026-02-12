import { createClient } from '../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workoutId, clientProgramId, scheduledDate } = await request.json()

  if (!workoutId || !scheduledDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Find any workout_log for this workout from today's session
  const { data: workoutLog } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('client_id', user.id)
    .eq('workout_id', workoutId)
    .eq('scheduled_date', scheduledDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Insert completion record with link to workout_log if found
  const { data, error } = await supabase
    .from('workout_completions')
    .upsert({
      client_id: user.id,
      workout_id: workoutId,
      client_program_id: clientProgramId || null,
      scheduled_date: scheduledDate,
      completed_at: new Date().toISOString(),
      workout_log_id: workoutLog?.id || null
    }, {
      onConflict: 'client_id,workout_id,scheduled_date'
    })
    .select()
    .single()

  if (error) {
    console.error('Error completing workout:', error)
    return NextResponse.json({ error: 'Failed to complete workout' }, { status: 500 })
  }

  // Update client_streaks
  try {
    // Get user's scheduled workout days from their active program
    const { data: clientPrograms } = await supabase
      .from('client_programs')
      .select(`
        id,
        program:programs (
          id,
          program_workouts (
            day_of_week
          )
        )
      `)
      .eq('client_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .single()

    // Get the scheduled days (0-6, Sunday = 0)
    const scheduledDays = new Set<number>()
    if (clientPrograms?.program) {
      const program = Array.isArray(clientPrograms.program) 
        ? clientPrograms.program[0] 
        : clientPrograms.program
      program?.program_workouts?.forEach((w: { day_of_week: number | null }) => {
        if (w.day_of_week !== null) {
          scheduledDays.add(w.day_of_week)
        }
      })
    }

    // Default to Mon-Fri if no schedule
    if (scheduledDays.size === 0) {
      [1, 2, 3, 4, 5].forEach(d => scheduledDays.add(d))
    }

    // Get all completions in the last 90 days
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    
    const { data: completions } = await supabase
      .from('workout_completions')
      .select('scheduled_date')
      .eq('client_id', user.id)
      .gte('scheduled_date', ninetyDaysAgo.toISOString().split('T')[0])
      .order('scheduled_date', { ascending: false })

    const completedDates = new Set(completions?.map(c => c.scheduled_date) || [])

    // Calculate streak
    let streak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Start checking from today
    let checkDate = new Date(today)
    
    // Check if today is completed (it should be, we just completed it)
    if (scheduledDays.has(today.getDay())) {
      const todayStr = today.toISOString().split('T')[0]
      if (completedDates.has(todayStr)) {
        streak = 1
      }
    }

    // Go back day by day checking scheduled days
    checkDate.setDate(checkDate.getDate() - 1)
    for (let i = 0; i < 365; i++) {
      const dayOfWeek = checkDate.getDay()
      
      if (scheduledDays.has(dayOfWeek)) {
        const dateStr = checkDate.toISOString().split('T')[0]
        
        if (completedDates.has(dateStr)) {
          streak++
        } else {
          break
        }
      }
      
      checkDate.setDate(checkDate.getDate() - 1)
    }

    // Get existing streak record to check longest_streak
    const { data: existingStreak } = await supabase
      .from('client_streaks')
      .select('longest_streak')
      .eq('client_id', user.id)
      .single()

    const longestStreak = Math.max(streak, existingStreak?.longest_streak || 0)

    // Upsert client_streaks
    await supabase
      .from('client_streaks')
      .upsert({
        client_id: user.id,
        current_streak: streak,
        longest_streak: longestStreak,
        last_workout_date: scheduledDate
      }, {
        onConflict: 'client_id'
      })
  } catch (streakError) {
    console.error('Error updating streak:', streakError)
    // Don't fail the request if streak update fails
  }

  return NextResponse.json({ success: true, completion: data })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  let query = supabase
    .from('workout_completions')
    .select('*')
    .eq('client_id', user.id)
    .order('scheduled_date', { ascending: false })

  if (startDate) {
    query = query.gte('scheduled_date', startDate)
  }
  if (endDate) {
    query = query.lte('scheduled_date', endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching completions:', error)
    return NextResponse.json({ error: 'Failed to fetch completions' }, { status: 500 })
  }

  return NextResponse.json({ completions: data })
}
