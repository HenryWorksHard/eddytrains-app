import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized, forbidden, isTrainerRole } from '@/app/lib/auth-guard'
import { formatDateToString } from '@/app/lib/dateUtils'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()
    if (!isTrainerRole(ctx.role)) return forbidden()

    const body = await request.json()
    const {
      clientId,
      workoutId,
      clientProgramId,
      trainerId, 
      completedAt, 
      scheduledDate,
      notes, 
      rating,
      sets,
      exercises // Array of { id, exercise_name } for exercise_uuid lookup
    } = body
    
    if (!clientId || !workoutId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // Assert same-org unless super_admin
    if (ctx.role !== 'super_admin') {
      const { data: clientProfile } = await adminClient
        .from('profiles')
        .select('organization_id')
        .eq('id', clientId)
        .single()
      if (!clientProfile || clientProfile.organization_id !== ctx.organizationId) {
        return forbidden()
      }
    }
    
    // Resolve scheduled_date once for both workout_log + completion.
    const resolvedScheduledDate: string =
      scheduledDate || completedAt?.split('T')[0] || formatDateToString(new Date())

    // Create workout log (include scheduled_date for lookup)
    const { data: workoutLog, error: logError } = await adminClient
      .from('workout_logs')
      .insert({
        client_id: clientId,
        workout_id: workoutId,
        trainer_id: trainerId || null,
        completed_at: completedAt || new Date().toISOString(),
        scheduled_date: resolvedScheduledDate,
        notes: notes || null,
        rating: rating || null
      })
      .select()
      .single()

    if (logError) {
      console.error('Error creating workout log:', logError)
      throw logError
    }

    // Create set logs with user_id and exercise_uuid for proper history lookup
    if (sets && sets.length > 0 && workoutLog) {
      // Get exercise_uuid for each exercise_id from workout_exercises
      const exerciseIds = [...new Set(sets.map((s: any) => s.exercise_id))]
      const { data: exerciseData } = await adminClient
        .from('workout_exercises')
        .select('id, exercise_uuid')
        .in('id', exerciseIds)
      
      const exerciseUuidMap = new Map(
        exerciseData?.map(e => [e.id, e.exercise_uuid]) || []
      )

      const setLogsToInsert = sets.map((set: any) => ({
        workout_log_id: workoutLog.id,
        exercise_id: set.exercise_id,
        exercise_uuid: exerciseUuidMap.get(set.exercise_id) || null,
        user_id: clientId, // Save under client's profile for history lookup
        set_number: set.set_number,
        weight_kg: set.weight_kg || null,
        reps_completed: set.reps_completed || null
      }))

      const { error: setsError } = await adminClient
        .from('set_logs')
        .insert(setLogsToInsert)

      if (setsError) {
        console.error('Error creating set logs:', setsError)
      }
    }

    // Upsert workout completion record (include workout_log_id for lookup).
    // Use upsert so re-running a coach session doesn't 23505 on the
    // (client_id, workout_id, scheduled_date) unique constraint.
    const { error: completionError } = await adminClient
      .from('workout_completions')
      .upsert({
        client_id: clientId,
        workout_id: workoutId,
        workout_log_id: workoutLog.id,
        client_program_id: clientProgramId || null,
        scheduled_date: resolvedScheduledDate,
        completed_at: completedAt || new Date().toISOString()
      }, {
        onConflict: 'client_id,workout_id,scheduled_date'
      })

    if (completionError) {
      console.error('Error creating workout completion:', completionError)
    }

    return NextResponse.json({ 
      success: true, 
      workoutLogId: workoutLog.id 
    })

  } catch (error) {
    console.error('Coaching complete error:', error)
    return NextResponse.json({ error: 'Failed to complete workout' }, { status: 500 })
  }
}
