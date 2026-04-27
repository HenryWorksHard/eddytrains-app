import { createClient } from '../../lib/supabase/server'
import { formatDateToString, parseLocalDate } from '../../lib/dateUtils'
import { NextRequest, NextResponse } from 'next/server'

// Calendar history window: previous month + current month + next month.
// 3 months is enough for typical streak walks (~60-90 days back) and
// for the user to flip a couple months in the calendar without a refetch.
// Falls back to client_streaks.longest_streak for anything longer.
const CALENDAR_MONTHS_BACK = 1  // previous month
const CALENDAR_MONTHS_FORWARD = 1  // next month

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Client-supplied "today" so windowing is in the user's timezone.
  const { searchParams } = new URL(request.url)
  const todayParam = searchParams.get('today')
  const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(todayParam || '')
    ? todayParam!
    : formatDateToString(new Date())

  const [ty, tm] = todayStr.split('-').map(Number)
  const windowStart = formatDateToString(
    new Date(ty, tm - 1 - CALENDAR_MONTHS_BACK, 1)
  )
  // Last day of (current month + CALENDAR_MONTHS_FORWARD)
  const windowEnd = formatDateToString(
    new Date(ty, tm + CALENDAR_MONTHS_FORWARD, 0)
  )

  // Run ALL queries in parallel
  const [
    profileResult,
    userProgramsResult,
    todayCompletionsResult,
    monthCompletionsResult,
    programStartResult,
    streakRowResult,
    latestPhotoResult,
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
    // workouts on the home screen.
    supabase
      .from('workout_completions')
      .select('workout_id, client_program_id, scheduled_date')
      .eq('client_id', user.id)
      .eq('scheduled_date', todayStr),

    // Calendar + streak-walk completions. workout_log_id so the client can
    // jump straight to the real logged workout when clicking a past day.
    supabase
      .from('workout_completions')
      .select('workout_id, client_program_id, scheduled_date, workout_log_id')
      .eq('client_id', user.id)
      .gte('scheduled_date', windowStart)
      .lte('scheduled_date', windowEnd),

    supabase
      .from('client_programs')
      .select('start_date')
      .eq('client_id', user.id)
      .eq('is_active', true)
      .order('start_date', { ascending: true })
      .limit(1),

    // Longest streak comes from the persistent streak table. Current
    // streak is computed below from monthCompletions + schedule.
    supabase
      .from('client_streaks')
      .select('longest_streak')
      .eq('client_id', user.id)
      .maybeSingle(),

    // Most recent progress photo — used to prompt for a new one on rest
    // days or after ~28 days of no uploads.
    supabase
      .from('progress_images')
      .select('created_at')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const profile = profileResult.data
  const userPrograms = userProgramsResult.data
  const todayCompletions = todayCompletionsResult.data
  const monthCompletions = monthCompletionsResult.data
  const programStartDates = programStartResult.data
  const streakRow = streakRowResult.data

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
  const scheduledDays = new Set<number>()
  let maxWeek = 1

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
            scheduledDays.add(workout.day_of_week)
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
              weekNumber: weekNum,
            })
          }
        }
      }
    }
  }

  // Default to Mon-Fri if user has no program yet
  if (scheduledDays.size === 0) {
    ;[1, 2, 3, 4, 5].forEach((d) => scheduledDays.add(d))
  }

  // ---------- Current-week selection for "Today's Workout" ----------
  // PREVIOUSLY: workoutsByDay was hardcoded to scheduleByWeekAndDay[1], so
  // clients on multi-week programs never progressed past Week 1. They'd do
  // the same Week 1 workouts repeatedly while the calendar (which correctly
  // cycles weeks) expected Week 2/3/4 workouts on those dates → mismatch →
  // calendar showed red despite real completions.
  //
  // NOW: compute current week from programStartDate + today (mirrors the
  // formula in WorkoutCalendar.getWeekNumberForDate). Falls back to Week 1
  // if no start date.
  const earliestStartDate = programStartDates?.[0]?.start_date
  let currentWeek = 1
  if (earliestStartDate) {
    const programStart = parseLocalDate(earliestStartDate)
    const todayLocal = parseLocalDate(todayStr)
    if (todayLocal >= programStart) {
      const diffMs = todayLocal.getTime() - programStart.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const rawWeek = Math.floor(diffDays / 7) + 1
      // Linear progression: clamp to the last week once the program ends.
      // Trainers extend a program by adding more weeks; clients should stay
      // on the latest week until that happens, not loop back to Week 1.
      if (maxWeek > 0) {
        currentWeek = Math.min(rawWeek, maxWeek)
      } else {
        currentWeek = rawWeek
      }
    }
  }
  const workoutsByDay: Record<number, WorkoutData[]> =
    scheduleByWeekAndDay[currentWeek] || scheduleByWeekAndDay[1] || {}

  // Today's completions set for the home screen
  const completedWorkoutIds: Set<string> = new Set()
  todayCompletions?.forEach((c) => {
    completedWorkoutIds.add(`${c.workout_id}:${c.client_program_id}`)
  })
  const completedWorkoutsArray = Array.from(completedWorkoutIds)

  // Calendar completions keyed by scheduled_date with multiple lookup shapes
  // so the calendar can robustly mark a day green even when the user logged
  // against a different workout_id than what this week's schedule now
  // expects (happens when weekly progression logic changes or historical
  // completions were recorded against Week 1 workouts).
  //
  // Keys populated for each completion:
  //   `${date}:${workout_id}:${client_program_id}`  — exact match
  //   `${date}:${workout_id}`                        — program-agnostic
  //   `${date}`                                      — date-only fallback
  //
  // The client picks the most specific key available.
  const calendarCompletions: Record<string, boolean> = {}
  const completedDateSet = new Set<string>()
  // Date → actual completion info so the calendar can link clicks on past
  // completed days to the REAL logged workout, not the week-computed one.
  const completionsByDate: Record<string, {
    workout_id: string
    client_program_id: string | null
    workout_log_id: string | null
  }> = {}
  monthCompletions?.forEach((c) => {
    const d = c.scheduled_date
    if (!d) return
    calendarCompletions[`${d}:${c.workout_id}:${c.client_program_id}`] = true
    calendarCompletions[`${d}:${c.workout_id}`] = true
    calendarCompletions[d] = true
    completedDateSet.add(d)
    // Keep first completion for a given date (most days have one workout)
    if (!completionsByDate[d]) {
      completionsByDate[d] = {
        workout_id: c.workout_id as string,
        client_program_id: (c.client_program_id as string | null) ?? null,
        workout_log_id: (c.workout_log_id as string | null) ?? null,
      }
    }
  })

  // Compute current streak from schedule + completions we already have.
  // Walk backwards from today, counting consecutive completed scheduled days.
  // Stops when it runs out of data or hits a missed scheduled day.
  const today = parseLocalDate(todayStr)
  let currentStreak = 0
  if (scheduledDays.has(today.getDay()) && completedDateSet.has(todayStr)) {
    currentStreak = 1
  }
  const checkDate = parseLocalDate(todayStr)
  checkDate.setDate(checkDate.getDate() - 1)
  // Walk back no further than the window we fetched — beyond that we have no data.
  const walkLimit = parseLocalDate(windowStart)
  while (checkDate >= walkLimit) {
    const dow = checkDate.getDay()
    if (scheduledDays.has(dow)) {
      const dateStr = formatDateToString(checkDate)
      if (completedDateSet.has(dateStr)) {
        currentStreak++
      } else {
        break
      }
    }
    checkDate.setDate(checkDate.getDate() - 1)
  }

  const longestStreak = Math.max(currentStreak, streakRow?.longest_streak ?? 0)

  // If current streak exceeds stored longest, persist the new record.
  // Fire-and-forget so we don't block the response.
  if (currentStreak > (streakRow?.longest_streak || 0)) {
    supabase
      .from('client_streaks')
      .upsert(
        {
          client_id: user.id,
          current_streak: currentStreak,
          longest_streak: currentStreak,
          last_workout_date: todayStr,
        },
        { onConflict: 'client_id' }
      )
      .then(() => {})
  }

  // Schedule by day for calendar
  const scheduleByDay: Record<
    number,
    { dayOfWeek: number; workoutId: string; workoutName: string; programName: string; programCategory: string; clientProgramId: string }[]
  > = {}
  for (let i = 0; i < 7; i++) {
    scheduleByDay[i] = (workoutsByDay[i] || []).map((w) => ({
      dayOfWeek: i,
      workoutId: w.workoutId,
      workoutName: w.workoutName,
      programName: w.programName,
      programCategory: w.programCategory,
      clientProgramId: w.clientProgramId,
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
    completionsByDate, // date → actual completed workout for click-through
    currentWeek, // which program week "today's workout" was served from
    programStartDate,
    maxWeek,
    // Streak data — eliminates the separate /api/workouts/streak round-trip.
    streak: currentStreak,
    longestStreak,
    scheduledDays: Array.from(scheduledDays),
    // Progress photo prompt state
    lastProgressPhotoDate: (latestPhotoResult.data?.created_at as string | null) || null,
  })
}
