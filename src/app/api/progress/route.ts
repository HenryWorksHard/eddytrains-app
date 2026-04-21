import { createClient } from '../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const timezone = searchParams.get('tz') || 'UTC'

  const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))

  // Week-over-week window bounds for the trend indicator.
  const weekAgo = new Date(nowInTz)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoIso = weekAgo.toISOString()

  const twoWeeksAgo = new Date(nowInTz)
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const twoWeeksAgoIso = twoWeeksAgo.toISOString()

  // Month bounds (local to user's tz).
  const monthStart = new Date(nowInTz.getFullYear(), nowInTz.getMonth(), 1)
  const monthStartStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`

  type JoinedSetLog = {
    weight_kg: number | null
    reps_completed: number | null
    workout_log_id: string
    created_at: string
    workout_logs: { client_id: string; completed_at: string | null } | null
    workout_exercises: { exercise_name: string | null } | null
  }

  const [
    oneRMsResult,
    progressImagesResult,
    setLogsResult,
    monthCompletionsResult,
    streakRowResult,
    programsResult,
  ] = await Promise.all([
    supabase
      .from('client_1rms')
      .select('exercise_name, weight_kg, updated_at')
      .eq('client_id', user.id)
      .order('weight_kg', { ascending: false }),

    supabase
      .from('progress_images')
      .select('id, image_url, created_at')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12),

    supabase
      .from('set_logs')
      .select(`
        weight_kg,
        reps_completed,
        workout_log_id,
        created_at,
        workout_logs!inner(client_id, completed_at),
        workout_exercises!inner(exercise_name)
      `)
      .eq('workout_logs.client_id', user.id)
      .not('weight_kg', 'is', null)
      .not('reps_completed', 'is', null)
      .returns<JoinedSetLog[]>(),

    // Workouts completed this calendar month — powers the "X of Y
    // scheduled days" recap card.
    supabase
      .from('workout_completions')
      .select('scheduled_date, completed_at')
      .eq('client_id', user.id)
      .gte('completed_at', monthStart.toISOString()),

    supabase
      .from('client_streaks')
      .select('current_streak, longest_streak')
      .eq('client_id', user.id)
      .maybeSingle(),

    // Active program schedule — used to count how many scheduled days
    // this month the client has hit vs missed for the recap card.
    supabase
      .from('client_programs')
      .select(`
        programs (
          program_workouts (
            day_of_week,
            parent_workout_id
          )
        )
      `)
      .eq('client_id', user.id)
      .eq('is_active', true),
  ])

  const oneRMs = oneRMsResult.data || []
  const progressImages = progressImagesResult.data || []
  const setLogs = setLogsResult.data || []
  const monthCompletions = monthCompletionsResult.data || []
  const streakRow = streakRowResult.data

  // Weekly tonnage (last 7 days) + previous week (7-14 days ago) for trend.
  let weeklyTonnage = 0
  let previousWeekTonnage = 0
  const bestByExercise = new Map<
    string,
    { weight_kg: number; reps: number; estimated_1rm: number; date: string }
  >()

  for (const log of setLogs) {
    const weight = log.weight_kg ?? 0
    const reps = log.reps_completed ?? 0
    const completedAt = log.workout_logs?.completed_at
    const exerciseName = log.workout_exercises?.exercise_name
    if (!weight || !reps || weight <= 0) continue

    if (completedAt) {
      if (completedAt >= weekAgoIso) {
        weeklyTonnage += weight * reps
      } else if (completedAt >= twoWeeksAgoIso) {
        previousWeekTonnage += weight * reps
      }
    }

    if (!exerciseName) continue
    const est = reps === 1 ? weight : weight * (1 + reps / 30)
    const key = exerciseName.toLowerCase()
    const existing = bestByExercise.get(key)
    if (!existing || est > existing.estimated_1rm) {
      bestByExercise.set(key, {
        weight_kg: weight,
        reps,
        estimated_1rm: Math.round(est * 10) / 10,
        date: log.created_at,
      })
    }
  }

  const estimated1RMs = Array.from(bestByExercise.entries())
    .map(([name, data]) => ({
      exercise_name: name.charAt(0).toUpperCase() + name.slice(1),
      ...data,
    }))
    .sort((a, b) => b.estimated_1rm - a.estimated_1rm)

  // Month recap: how many workouts done vs how many scheduled days so far.
  const monthCompletionsCount = monthCompletions.length

  const scheduledDows = new Set<number>()
  for (const cp of programsResult.data || []) {
    const programData = cp.programs as unknown
    const program = (Array.isArray(programData) ? programData[0] : programData) as {
      program_workouts?: { day_of_week: number | null; parent_workout_id: string | null }[]
    } | null
    program?.program_workouts?.forEach((w) => {
      if (w.parent_workout_id) return
      if (w.day_of_week !== null) scheduledDows.add(w.day_of_week)
    })
  }

  // Count scheduled days from month start through today (not future).
  let scheduledSoFar = 0
  const cursor = new Date(monthStart)
  const todayLocal = new Date(nowInTz.getFullYear(), nowInTz.getMonth(), nowInTz.getDate())
  while (cursor <= todayLocal) {
    if (scheduledDows.has(cursor.getDay())) scheduledSoFar++
    cursor.setDate(cursor.getDate() + 1)
  }

  const tonnageTrendPct =
    previousWeekTonnage > 0
      ? Math.round(((weeklyTonnage - previousWeekTonnage) / previousWeekTonnage) * 100)
      : null

  return NextResponse.json({
    oneRMs,
    estimated1RMs,
    progressImages,
    weeklyTonnage,
    previousWeekTonnage,
    tonnageTrendPct, // null if prev week is 0
    monthCompletions: monthCompletionsCount,
    monthScheduled: scheduledSoFar,
    monthStart: monthStartStr,
    streak: streakRow?.current_streak ?? 0,
    longestStreak: streakRow?.longest_streak ?? 0,
  })
}
