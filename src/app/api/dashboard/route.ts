import { createClient } from '../../lib/supabase/server'
import { formatDateToString, parseLocalDate } from '../../lib/dateUtils'
import { NextRequest, NextResponse } from 'next/server'
import { entitlementOrFilter } from '@/app/lib/entitlements'

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
      .select('full_name, pascal_name, pascal_color, pascal_skin, pascal_outfit, pascal_character')
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
      .eq('is_active', true)
      .or(entitlementOrFilter(todayStr)),

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
      .or(entitlementOrFilter(todayStr))
      .order('start_date', { ascending: true })
      .limit(1),

    // Longest streak comes from the persistent streak table. Current
    // streak is computed below from monthCompletions + schedule.
    supabase
      .from('client_streaks')
      .select('longest_streak, current_streak')
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

  // Per-program metadata so we can compute each program's OWN current week
  // independently. Audit fix (2026-08-23): previously a single currentWeek
  // (from the earliest program's start) selected across ALL programs, so a
  // brand-new second program would show its Week-N template on day one.
  const programMeta = new Map<string, { startDate: string | null; maxWeek: number }>()

  scheduleByWeekAndDay[1] = {}
  for (let i = 0; i < 7; i++) {
    scheduleByWeekAndDay[1][i] = []
  }

  if (userPrograms) {
    for (const up of userPrograms) {
      const upStartDate = (up as { start_date?: string | null }).start_date ?? null
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

            // Track this program's own max week + start date.
            const prevMeta = programMeta.get(up.id)
            programMeta.set(up.id, {
              startDate: upStartDate,
              maxWeek: Math.max(prevMeta?.maxWeek ?? 1, weekNum),
            })

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
  // Audit fix (2026-08-23): compute each program's current week from ITS
  // OWN start_date, then union the current-week workouts across all active
  // programs. Previously a single currentWeek (from the earliest program's
  // start, clamped to the global maxWeek) was applied to every program, so
  // a brand-new second program would serve its Week-N template on day one
  // — client sees week 4 of a program they started today.
  const todayLocal = parseLocalDate(todayStr)

  // Per-program current week (1-based, clamped to that program's own last
  // week). Programs with no start date default to week 1.
  const currentWeekForProgram = (clientProgramId: string): number => {
    const meta = programMeta.get(clientProgramId)
    if (!meta?.startDate) return 1
    const programStart = parseLocalDate(meta.startDate)
    if (todayLocal < programStart) return 1
    const diffDays = Math.floor(
      (todayLocal.getTime() - programStart.getTime()) / (1000 * 60 * 60 * 24)
    )
    const rawWeek = Math.floor(diffDays / 7) + 1
    return meta.maxWeek > 0 ? Math.min(rawWeek, meta.maxWeek) : rawWeek
  }

  // Build workoutsByDay by unioning each program's current-week workouts.
  const workoutsByDay: Record<number, WorkoutData[]> = {}
  for (let i = 0; i < 7; i++) workoutsByDay[i] = []
  for (const [clientProgramId] of programMeta) {
    const wk = currentWeekForProgram(clientProgramId)
    const weekSchedule = scheduleByWeekAndDay[wk]
    if (!weekSchedule) continue
    for (let day = 0; day < 7; day++) {
      for (const w of weekSchedule[day] || []) {
        // Only take this program's own workouts at its own current week.
        if (w.clientProgramId === clientProgramId) {
          workoutsByDay[day].push(w)
        }
      }
    }
  }

  // Back-compat: a single "currentWeek" is still returned for consumers
  // that expect it (calendar's initial week). Use the earliest program's
  // computed week so the calendar's default view is sensible.
  const earliestStartDate = programStartDates?.[0]?.start_date
  let currentWeek = 1
  if (earliestStartDate) {
    const programStart = parseLocalDate(earliestStartDate)
    if (todayLocal >= programStart) {
      const diffDays = Math.floor(
        (todayLocal.getTime() - programStart.getTime()) / (1000 * 60 * 60 * 24)
      )
      const rawWeek = Math.floor(diffDays / 7) + 1
      currentWeek = maxWeek > 0 ? Math.min(rawWeek, maxWeek) : rawWeek
    }
  }

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
    const entry = {
      workout_id: c.workout_id as string,
      client_program_id: (c.client_program_id as string | null) ?? null,
      workout_log_id: (c.workout_log_id as string | null) ?? null,
    }
    // Audit fix (2026-08-26): also index by date:workout_id so a day with
    // multiple completed workouts resolves each card to its OWN log — the
    // date-only key alone made "View Log" on workout B open workout A.
    completionsByDate[`${d}:${c.workout_id}`] = entry
    // Keep the date-only key too (first completion) for legacy callers.
    if (!completionsByDate[d]) {
      completionsByDate[d] = entry
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
  // Re-audit fix (2026-08-26): track whether the walk terminated because
  // it hit a MISSED day (streak genuinely broke → the count is complete
  // and authoritative) vs. because it ran out of fetched data (the count
  // is a floor, not the true streak). We only persist the authoritative
  // case; otherwise we'd clobber the accurate 365-day walk that
  // /api/workouts/complete wrote.
  let walkResolvedNaturally = false
  while (checkDate >= walkLimit) {
    const dow = checkDate.getDay()
    if (scheduledDays.has(dow)) {
      const dateStr = formatDateToString(checkDate)
      if (completedDateSet.has(dateStr)) {
        currentStreak++
      } else {
        walkResolvedNaturally = true // hit a real missed day
        break
      }
    }
    checkDate.setDate(checkDate.getDate() - 1)
  }

  const streakIsAuthoritative = walkResolvedNaturally || currentStreak === 0
  const longestStreak = Math.max(currentStreak, streakRow?.longest_streak ?? 0)

  // Persist ONLY when this walk is authoritative (it hit a missed day, so
  // the full streak is contained in our window) — otherwise a client with
  // a streak longer than the ~30-60 day fetch window would have the
  // truncated floor written over the accurate value from
  // /api/workouts/complete. And NEVER stamp last_workout_date here: this
  // runs on every dashboard load, workout or not — stamping it would
  // falsely mark the client as "trained today" and destroy the
  // went-dark signal that trainer views + alerts rely on. The complete
  // route owns last_workout_date.
  if (streakIsAuthoritative) {
    const priorLongest = streakRow?.longest_streak || 0
    const nextLongest = Math.max(priorLongest, currentStreak)
    supabase
      .from('client_streaks')
      .upsert(
        {
          client_id: user.id,
          current_streak: currentStreak,
          longest_streak: nextLongest,
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
    // Per-program week metadata so the calendar can compute each program's
    // own week (re-audit fix 2026-08-26 — the calendar was still using a
    // single global week and disagreeing with the Today's Workout card for
    // multi-program clients).
    programWeekMeta: Object.fromEntries(
      Array.from(programMeta.entries()).map(([cpId, m]) => [
        cpId,
        { startDate: m.startDate, maxWeek: m.maxWeek },
      ])
    ),
    // Streak data — eliminates the separate /api/workouts/streak round-trip.
    // When our walk was truncated by the fetch window (non-authoritative)
    // the live count is only a floor — show the larger of it and the
    // stored value so a long streak isn't visually truncated.
    streak: streakIsAuthoritative
      ? currentStreak
      : Math.max(currentStreak, streakRow?.current_streak ?? 0),
    longestStreak,
    scheduledDays: Array.from(scheduledDays),
    // Progress photo prompt state
    lastProgressPhotoDate: (latestPhotoResult.data?.created_at as string | null) || null,
    // Pascal customization — null fields fall back to defaults client-side.
    pascalName: (profile?.pascal_name as string | null) || null,
    pascalColor: (profile?.pascal_color as string | null) || null,
    pascalSkin: (profile?.pascal_skin as string | null) || null,
    pascalOutfit: (profile?.pascal_outfit as string | null) || null,
    pascalCharacter: (profile?.pascal_character as string | null) || null,
  })
}
