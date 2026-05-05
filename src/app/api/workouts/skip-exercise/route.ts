import { createClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST: skip an exercise within a workout session.
 * Body: { workoutId, scheduledDate, workoutExerciseId, exerciseName, reasonCategory?, reasonDetails? }
 *
 * Creates a workout_log shell first if one doesn't exist (mirrors the
 * pattern in /api/workouts/complete) so the skip row always has a
 * workout_log_id to anchor on. Idempotent — upserts on the unique
 * (workout_log_id, workout_exercise_id) constraint.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { workoutId, scheduledDate, workoutExerciseId, exerciseName, reasonCategory, reasonDetails } = body

  if (!workoutId || !scheduledDate || !workoutExerciseId || !exerciseName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (reasonCategory && !['injury', 'equipment', 'time', 'other'].includes(reasonCategory)) {
    return NextResponse.json({ error: 'Invalid reason category' }, { status: 400 })
  }

  // Find or create the workout_log for this session.
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

  const { data: skip, error } = await supabase
    .from('workout_exercise_skips')
    .upsert(
      {
        client_id: user.id,
        workout_log_id: workoutLogId,
        workout_exercise_id: workoutExerciseId,
        exercise_name: exerciseName,
        reason_category: reasonCategory || null,
        reason_details: reasonDetails ? String(reasonDetails).trim().slice(0, 500) : null,
      },
      { onConflict: 'workout_log_id,workout_exercise_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('Error saving skip:', error)
    return NextResponse.json({ error: 'Failed to save skip' }, { status: 500 })
  }

  return NextResponse.json({ skip })
}

/**
 * DELETE: undo a skip. Body: { workoutId, scheduledDate, workoutExerciseId }.
 * Looks up the workout_log via the (client, workout, scheduled_date) tuple
 * then deletes the skip row. Returns ok even if no skip existed.
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
    .from('workout_exercise_skips')
    .delete({ count: 'exact' })
    .eq('workout_log_id', log.id)
    .eq('workout_exercise_id', workoutExerciseId)
    .eq('client_id', user.id)

  if (error) {
    console.error('Error deleting skip:', error)
    return NextResponse.json({ error: 'Failed to remove skip' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, removed: count ?? 0 })
}
