import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized, forbidden, isTrainerRole } from '@/app/lib/auth-guard'

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
    const { workoutLogId, sets } = body

    if (!workoutLogId || !sets) {
      return NextResponse.json({ error: 'Missing workoutLogId or sets' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // Resolve the client for this workoutLog and assert same-org.
    const { data: wl } = await adminClient
      .from('workout_logs')
      .select('client_id')
      .eq('id', workoutLogId)
      .single()
    if (!wl) return NextResponse.json({ error: 'Workout log not found' }, { status: 404 })

    if (ctx.role !== 'super_admin') {
      const { data: clientProfile } = await adminClient
        .from('profiles')
        .select('organization_id')
        .eq('id', wl.client_id)
        .single()
      if (!clientProfile || clientProfile.organization_id !== ctx.organizationId) {
        return forbidden()
      }
    }

    for (const set of sets) {
      const { error } = await adminClient
        .from('set_logs')
        .update({
          weight_kg: set.weight_kg,
          reps_completed: set.reps_completed
        })
        .eq('workout_log_id', workoutLogId)
        .eq('exercise_id', set.exercise_id)
        .eq('set_number', set.set_number)

      if (error) {
        console.error('Error updating set:', error)
      }
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Coaching update error:', error)
    return NextResponse.json({ error: 'Failed to update sets' }, { status: 500 })
  }
}
