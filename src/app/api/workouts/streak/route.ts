import { createClient } from '../../../lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  // Calculate streak - count consecutive scheduled workout days completed
  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Start from yesterday (today might not be over yet)
  let checkDate = new Date(today)
  checkDate.setDate(checkDate.getDate() - 1)
  
  // Check if today is a scheduled day and has been completed
  if (scheduledDays.has(today.getDay())) {
    const todayStr = today.toISOString().split('T')[0]
    if (completedDates.has(todayStr)) {
      streak = 1
    }
  }

  // Go back day by day checking scheduled days
  for (let i = 0; i < 365; i++) {
    const dayOfWeek = checkDate.getDay()
    
    // Only check scheduled workout days
    if (scheduledDays.has(dayOfWeek)) {
      const dateStr = checkDate.toISOString().split('T')[0]
      
      if (completedDates.has(dateStr)) {
        streak++
      } else {
        // Streak broken
        break
      }
    }
    
    checkDate.setDate(checkDate.getDate() - 1)
  }

  return NextResponse.json({ 
    streak,
    scheduledDays: Array.from(scheduledDays)
  })
}
