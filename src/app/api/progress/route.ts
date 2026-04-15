import { createClient } from '../../lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use client timezone for accurate "this week" calculation
  const { searchParams } = new URL(request.url)
  const timezone = searchParams.get('tz') || 'UTC'

  const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
  const weekAgo = new Date(nowInTz)
  weekAgo.setDate(weekAgo.getDate() - 7)

  // Run all queries in parallel
  const [oneRMsResult, progressImagesResult, recentLogsResult, allLogsResult] = await Promise.all([
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
      .from('workout_logs')
      .select('id')
      .eq('client_id', user.id)
      .gte('completed_at', weekAgo.toISOString()),

    // All workout logs for estimated 1RM calculation
    supabase
      .from('workout_logs')
      .select('id')
      .eq('client_id', user.id)
  ])

  const oneRMs = oneRMsResult.data || []
  const progressImages = progressImagesResult.data || []
  const logIds = recentLogsResult.data?.map(l => l.id) || []
  const allLogIds = allLogsResult.data?.map(l => l.id) || []

  let weeklyTonnage = 0
  if (logIds.length > 0) {
    const { data: setLogs } = await supabase
      .from('set_logs')
      .select('weight_kg, reps_completed')
      .in('workout_log_id', logIds)

    weeklyTonnage = setLogs?.reduce((sum, s) => {
      return sum + ((s.weight_kg || 0) * (s.reps_completed || 0))
    }, 0) || 0
  }

  // Calculate estimated 1RMs from all logged sets using Epley formula
  let estimated1RMs: { exercise_name: string; weight_kg: number; reps: number; estimated_1rm: number; date: string }[] = []

  if (allLogIds.length > 0) {
    // Fetch set logs with exercise info
    const { data: allSetLogs } = await supabase
      .from('set_logs')
      .select('exercise_id, weight_kg, reps_completed, workout_log_id, created_at')
      .in('workout_log_id', allLogIds)
      .not('weight_kg', 'is', null)
      .not('reps_completed', 'is', null)

    // Get exercise name lookup
    const exerciseIds = [...new Set(allSetLogs?.map(s => s.exercise_id) || [])]
    let exerciseNameLookup = new Map<string, string>()

    if (exerciseIds.length > 0) {
      const { data: exercises } = await supabase
        .from('workout_exercises')
        .select('id, exercise_name')
        .in('id', exerciseIds)

      exerciseNameLookup = new Map(exercises?.map(e => [e.id, e.exercise_name]) || [])
    }

    // Find best estimated 1RM per exercise (Epley: weight × (1 + reps/30))
    const bestByExercise = new Map<string, { weight_kg: number; reps: number; estimated_1rm: number; date: string }>()

    allSetLogs?.forEach(log => {
      const name = exerciseNameLookup.get(log.exercise_id)
      if (!name || !log.weight_kg || !log.reps_completed || log.weight_kg <= 0) return

      const estimated1RM = log.reps_completed === 1
        ? log.weight_kg
        : log.weight_kg * (1 + log.reps_completed / 30)

      const key = name.toLowerCase()
      const existing = bestByExercise.get(key)

      if (!existing || estimated1RM > existing.estimated_1rm) {
        bestByExercise.set(key, {
          weight_kg: log.weight_kg,
          reps: log.reps_completed,
          estimated_1rm: Math.round(estimated1RM * 10) / 10,
          date: log.created_at
        })
      }
    })

    estimated1RMs = Array.from(bestByExercise.entries())
      .map(([name, data]) => ({
        exercise_name: name.charAt(0).toUpperCase() + name.slice(1),
        ...data
      }))
      .sort((a, b) => b.estimated_1rm - a.estimated_1rm)
  }

  return NextResponse.json({
    oneRMs,
    estimated1RMs,
    progressImages,
    weeklyTonnage
  })
}
