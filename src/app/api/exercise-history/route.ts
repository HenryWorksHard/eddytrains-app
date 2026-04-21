import { createClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/exercise-history?exercise=NAME&limit=5
 *
 * Returns the user's last N sessions of a given exercise (matched by
 * exercise_name, case-insensitive). Each session groups the sets that
 * were logged under the same workout_log.
 *
 * Used by the in-workout "history drawer" — the client taps an
 * exercise's history icon and sees what they did last time, and the
 * few times before that, to help pick weights for today.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const exerciseName = (searchParams.get('exercise') || '').trim()
  const limitParam = Number(searchParams.get('limit') || 5)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(1, limitParam), 10) : 5

  if (!exerciseName) {
    return NextResponse.json({ sessions: [] })
  }

  // Pull set_logs joined to workout_logs (for client filter + completed_at)
  // and workout_exercises (for exercise_name). Filter by exercise_name ilike
  // to match "Back Squat" regardless of case / stray whitespace.
  type JoinedSetLog = {
    set_number: number
    weight_kg: number | null
    reps_completed: number | null
    workout_log_id: string
    workout_logs: { client_id: string; completed_at: string | null; scheduled_date: string | null } | null
    workout_exercises: { exercise_name: string | null } | null
  }

  const { data, error } = await supabase
    .from('set_logs')
    .select(`
      set_number,
      weight_kg,
      reps_completed,
      workout_log_id,
      workout_logs!inner(client_id, completed_at, scheduled_date),
      workout_exercises!inner(exercise_name)
    `)
    .eq('workout_logs.client_id', user.id)
    .ilike('workout_exercises.exercise_name', exerciseName)
    .not('weight_kg', 'is', null)
    .not('reps_completed', 'is', null)
    .order('set_number', { ascending: true })
    .returns<JoinedSetLog[]>()

  if (error) {
    console.error('[exercise-history] fetch error:', error)
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 })
  }

  // Group by workout_log_id → one session per parent log.
  const sessionsMap = new Map<
    string,
    {
      workoutLogId: string
      date: string | null
      sets: { setNumber: number; weight: number; reps: number }[]
    }
  >()

  for (const row of data || []) {
    const key = row.workout_log_id
    const existing = sessionsMap.get(key)
    const setRow = {
      setNumber: row.set_number,
      weight: Number(row.weight_kg || 0),
      reps: Number(row.reps_completed || 0),
    }
    if (existing) {
      existing.sets.push(setRow)
    } else {
      sessionsMap.set(key, {
        workoutLogId: key,
        date: row.workout_logs?.completed_at || row.workout_logs?.scheduled_date || null,
        sets: [setRow],
      })
    }
  }

  // Sort sessions newest first and take `limit`.
  const sessions = Array.from(sessionsMap.values())
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, limit)

  return NextResponse.json({ sessions })
}
