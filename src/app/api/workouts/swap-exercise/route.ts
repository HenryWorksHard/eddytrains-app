import { createClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST: persist an exercise swap for a workout session.
 * Body: { workoutId, scheduledDate, workoutExerciseId, substitutedExerciseName, isCustom?, customExerciseId? }
 *
 * Creates a workout_log shell first if one doesn't exist (mirrors the
 * skip-exercise + complete-workout pattern) so the swap row always has
 * a workout_log_id to anchor on. Idempotent — upserts on the unique
 * (workout_log_id, workout_exercise_id) constraint.
 *
 * This makes the swap persist BEFORE any sets are logged, fixing the
 * bug where swapping then leaving the page lost the swap (set_logs
 * fallback only kicks in after a set is saved).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { workoutId, scheduledDate, workoutExerciseId, substitutedExerciseName, isCustom, customExerciseId } = body

  if (!workoutId || !scheduledDate || !workoutExerciseId || !substitutedExerciseName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: existingLog } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('client_id', user.id)
    .eq('workout_id', workoutId)
    .eq('scheduled_date', scheduledDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

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
    if (newLogErr || !newLog) {
      console.error('Error creating workout_log shell:', newLogErr)
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }
    workoutLogId = newLog.id
  }

  const { data: swap, error } = await supabase
    .from('workout_exercise_swaps')
    .upsert(
      {
        client_id: user.id,
        workout_log_id: workoutLogId,
        workout_exercise_id: workoutExerciseId,
        substituted_exercise_name: String(substitutedExerciseName).trim().slice(0, 200),
        is_custom: Boolean(isCustom),
        custom_exercise_id: customExerciseId || null,
      },
      { onConflict: 'workout_log_id,workout_exercise_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('Error saving swap:', error)
    return NextResponse.json({ error: 'Failed to save swap' }, { status: 500 })
  }

  return NextResponse.json({ swap })
}

/**
 * DELETE: undo a swap (currently no UI, kept for symmetry with skip).
 * Body: { workoutId, scheduledDate, workoutExerciseId }.
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { workoutId, scheduledDate, workoutExerciseId } = body

  if (!workoutId || !scheduledDate || !workoutExerciseId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: log } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('client_id', user.id)
    .eq('workout_id', workoutId)
    .eq('scheduled_date', scheduledDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!log?.id) {
    return NextResponse.json({ ok: true, removed: 0 })
  }

  const { error, count } = await supabase
    .from('workout_exercise_swaps')
    .delete({ count: 'exact' })
    .eq('workout_log_id', log.id)
    .eq('workout_exercise_id', workoutExerciseId)
    .eq('client_id', user.id)

  if (error) {
    console.error('Error deleting swap:', error)
    return NextResponse.json({ error: 'Failed to remove swap' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, removed: count ?? 0 })
}
