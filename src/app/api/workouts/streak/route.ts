import { createClient } from '../../../lib/supabase/server'
import { formatDateToString, parseLocalDate } from '../../../lib/dateUtils'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Anchor "today" on the client's local date when provided. Without
  // this, users in non-UTC timezones can see their streak flicker or
  // break at midnight because the server computes "today" in UTC.
  const { searchParams } = new URL(request.url)
  const todayParam = searchParams.get('today')
  const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(todayParam || '')
    ? todayParam!
    : formatDateToString(new Date())

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

  // Get all completions in the last 90 days (anchored on client today).
  const today = parseLocalDate(todayStr)
  const ninetyDaysAgo = parseLocalDate(todayStr)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { data: completions } = await supabase
    .from('workout_completions')
    .select('scheduled_date')
    .eq('client_id', user.id)
    .gte('scheduled_date', formatDateToString(ninetyDaysAgo))
    .order('scheduled_date', { ascending: false })

  const completedDates = new Set(completions?.map(c => c.scheduled_date) || [])

  // Calculate streak - count consecutive scheduled workout days completed.
  // All date math runs through parseLocalDate + formatDateToString so the
  // YYYY-MM-DD keys we build always line up with workout_completions rows
  // regardless of server timezone.
  let streak = 0

  // Check if today is a scheduled day and has been completed
  if (scheduledDays.has(today.getDay()) && completedDates.has(todayStr)) {
    streak = 1
  }

  // Walk backwards from yesterday, counting consecutive scheduled days
  // that were completed. Stop at the first missed scheduled day.
  const checkDate = parseLocalDate(todayStr)
  checkDate.setDate(checkDate.getDate() - 1)

  for (let i = 0; i < 365; i++) {
    const dayOfWeek = checkDate.getDay()

    // Only check scheduled workout days
    if (scheduledDays.has(dayOfWeek)) {
      const dateStr = formatDateToString(checkDate)

      if (completedDates.has(dateStr)) {
        streak++
      } else {
        // Streak broken
        break
      }
    }

    checkDate.setDate(checkDate.getDate() - 1)
  }

  // Fetch longest streak from client_streaks (persisted best)
  let longestStreak = streak
  const { data: streakRow } = await supabase
    .from('client_streaks')
    .select('longest_streak')
    .eq('client_id', user.id)
    .single()

  if (streakRow?.longest_streak && streakRow.longest_streak > longestStreak) {
    longestStreak = streakRow.longest_streak
  }

  // If current streak exceeds stored longest, update it
  if (streak > (streakRow?.longest_streak || 0)) {
    longestStreak = streak
    await supabase
      .from('client_streaks')
      .upsert({
        client_id: user.id,
        current_streak: streak,
        longest_streak: streak,
        last_workout_date: todayStr
      }, { onConflict: 'client_id' })
  }

  return NextResponse.json({
    streak,
    longestStreak,
    scheduledDays: Array.from(scheduledDays)
  })
}
