import { createClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/exercise-history?exercise=NAME&limit=5
 *
 * Returns the user's last N sessions of a given exercise. The match is
 * **swap-aware**: a row counts if
 *   - set_logs.swapped_exercise_name ILIKE name (the user explicitly
 *     swapped INTO this exercise from a different slot), OR
 *   - workout_exercises.exercise_name ILIKE name AND
 *     set_logs.swapped_exercise_name IS NULL (the user did the original
 *     program slot, no swap).
 *
 * Without that COALESCE-style match, asking for "Dumbbell Press" after
 * the client swapped Bench → DB Press would return nothing, because the
 * program slot is still named "Bench Press" — even though the logged
 * sets carry swapped_exercise_name='Dumbbell Press'.
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

  type JoinedSetLog = {
    set_number: number
    weight_kg: number | null
    reps_completed: number | null
    workout_log_id: string
    swapped_exercise_name: string | null
    workout_logs: { client_id: string; completed_at: string | null; scheduled_date: string | null } | null
    workout_exercises: { exercise_name: string | null } | null
  }

  const nameLower = exerciseName.toLowerCase()

  // Pull a generous slice of recent logs for this user; filter swap-aware
  // in JS. Doing the OR on a relationship column in PostgREST is awkward,
  // and the per-user row count is small enough that client-side filtering
  // is fine.
  const { data, error } = await supabase
    .from('set_logs')
    .select(`
      set_number,
      weight_kg,
      reps_completed,
      workout_log_id,
      swapped_exercise_name,
      workout_logs!inner(client_id, completed_at, scheduled_date),
      workout_exercises!inner(exercise_name)
    `)
    .eq('workout_logs.client_id', user.id)
    .not('weight_kg', 'is', null)
    .not('reps_completed', 'is', null)
    .order('workout_log_id', { ascending: false })
    .limit(500)
    .returns<JoinedSetLog[]>()

  if (error) {
    console.error('[exercise-history] fetch error:', error)
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 })
  }

  // Swap-aware match: a set counts if it was logged as the requested
  // exercise — either via the swap field or the original slot name.
  const matches = (data || []).filter((row) => {
    const swapped = row.swapped_exercise_name?.toLowerCase().trim()
    if (swapped) return swapped === nameLower
    const original = row.workout_exercises?.exercise_name?.toLowerCase().trim()
    return original === nameLower
  })

  // Group by workout_log_id → one session per parent log.
  const sessionsMap = new Map<
    string,
    {
      workoutLogId: string
      date: string | null
      sets: { setNumber: number; weight: number; reps: number }[]
    }
  >()

  for (const row of matches) {
    const key = row.workout_log_id
    const setRow = {
      setNumber: row.set_number,
      weight: Number(row.weight_kg || 0),
      reps: Number(row.reps_completed || 0),
    }
    const existing = sessionsMap.get(key)
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

  for (const session of sessionsMap.values()) {
    session.sets.sort((a, b) => a.setNumber - b.setNumber)
  }

  const sessions = Array.from(sessionsMap.values())
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, limit)

  return NextResponse.json({ sessions })
}
