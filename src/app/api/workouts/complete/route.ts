import { getVerifiedUser } from '@/app/lib/auth-claims'
import { createClient } from '../../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { recomputeAndPersistPascal } from '../../../lib/pascal-server'
import { formatDateToString, parseLocalDate } from '../../../lib/dateUtils'
import { entitlementOrFilter } from '@/app/lib/entitlements'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const user = await getVerifiedUser(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { workoutId, clientProgramId, scheduledDate, tz } = await request.json()

  if (!workoutId || !scheduledDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Look up an existing workout_log for (client, workout, scheduled_date).
  // The unique constraint guarantees at most one, but use maybeSingle for safety.
  const { data: existingLog } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('client_id', user.id)
    .eq('workout_id', workoutId)
    .eq('scheduled_date', scheduledDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // If no log exists yet (e.g. user tapped Complete on a workout they never
  // opened in the logger), create an empty shell so the trainer portal can
  // always resolve set data via workout_log_id.
  let workoutLogId: string | null = existingLog?.id || null
  if (!workoutLogId) {
    const { data: newLog, error: newLogErr } = await supabase
      .from('workout_logs')
      .insert({
        client_id: user.id,
        workout_id: workoutId,
        scheduled_date: scheduledDate,
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (newLogErr) {
      // Audit fix (2026-08-23): the unique constraint on
      // (client_id, workout_id, scheduled_date) can trip if the client's
      // autosave created the shell concurrently. Previously we just logged
      // and left workoutLogId null → the completion row got a null
      // workout_log_id and the trainer portal couldn't join to set data.
      // Now re-query for the row the race winner created.
      console.error('Error creating workout_log shell, re-querying:', newLogErr)
      const { data: raceWinner } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('client_id', user.id)
        .eq('workout_id', workoutId)
        .eq('scheduled_date', scheduledDate)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      workoutLogId = raceWinner?.id ?? null
    } else {
      workoutLogId = newLog.id
    }
  }

  // Upsert completion, always with workout_log_id populated when we have one.
  const { data, error } = await supabase
    .from('workout_completions')
    .upsert({
      client_id: user.id,
      workout_id: workoutId,
      client_program_id: clientProgramId || null,
      scheduled_date: scheduledDate,
      completed_at: new Date().toISOString(),
      workout_log_id: workoutLogId
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
      .or(entitlementOrFilter())
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
      .gte('scheduled_date', formatDateToString(ninetyDaysAgo))
      .order('scheduled_date', { ascending: false })

    const completedDates = new Set(completions?.map(c => c.scheduled_date) || [])

    // Calculate streak.
    // Audit fix (2026-08-23): anchor the walk on `scheduledDate` (the
    // user-local date of the workout we just completed) instead of the
    // server's new Date() which is UTC in prod. For a user far from UTC
    // (e.g. AEST completing at 8am local = 22:00 UTC prior day), the
    // server "today" and the client-stored scheduled_date disagreed, so
    // completedDates.has(serverToday) missed and the streak read 0.
    // parseLocalDate builds a Date from the plain Y-M-D so getDay()
    // yields the correct weekday regardless of server tz.
    let streak = 0
    const anchor = parseLocalDate(scheduledDate)

    // Check if the completed day itself counts (it should — we just
    // completed it) before walking backwards.
    if (scheduledDays.has(anchor.getDay()) && completedDates.has(scheduledDate)) {
      streak = 1
    }

    // Go back day by day checking scheduled days.
    const checkDate = new Date(anchor)
    checkDate.setDate(checkDate.getDate() - 1)
    for (let i = 0; i < 365; i++) {
      const dayOfWeek = checkDate.getDay()

      if (scheduledDays.has(dayOfWeek)) {
        const dateStr = formatDateToString(checkDate)

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

  // Bring Pascal up to date so the dashboard reflects the bump instantly
  // when the user returns. Any decay/missed-day penalties between
  // last_processed_date and today are applied alongside the new +10.
  let pascal = null
  try {
    pascal = await recomputeAndPersistPascal(supabase, user.id, tz || 'UTC')
  } catch (pascalError) {
    console.error('Error updating Pascal score:', pascalError)
  }

  return NextResponse.json({ success: true, completion: data, pascal })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  const user = await getVerifiedUser(supabase)
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
