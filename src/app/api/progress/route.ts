import { createClient } from '../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Client timezone for accurate "this week" calculation
  const { searchParams } = new URL(request.url)
  const timezone = searchParams.get('tz') || 'UTC'

  const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
  const weekAgo = new Date(nowInTz)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoIso = weekAgo.toISOString()

  // Single relational query: set_logs joined to workout_logs (for client
  // filter + completed_at) and workout_exercises (for exercise_name).
  // Replaces the previous 3-step waterfall (workout_logs → set_logs →
  // workout_exercises).
  type JoinedSetLog = {
    weight_kg: number | null
    reps_completed: number | null
    workout_log_id: string
    created_at: string
    workout_logs: { client_id: string; completed_at: string | null } | null
    workout_exercises: { exercise_name: string | null } | null
  }

  const [oneRMsResult, progressImagesResult, setLogsResult] = await Promise.all([
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
  ])

  const oneRMs = oneRMsResult.data || []
  const progressImages = progressImagesResult.data || []
  const setLogs = setLogsResult.data || []

  // Weekly tonnage: sum over set_logs whose parent workout_log.completed_at
  // falls inside the last 7 days.
  let weeklyTonnage = 0
  // Best estimated 1RM per exercise (Epley: weight × (1 + reps/30))
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

    // Weekly tonnage
    if (completedAt && completedAt >= weekAgoIso) {
      weeklyTonnage += weight * reps
    }

    // Estimated 1RM
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

  return NextResponse.json({
    oneRMs,
    estimated1RMs,
    progressImages,
    weeklyTonnage,
  })
}
