import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized, forbidden, isTrainerRole, getEffectiveOrgIdStrict } from '@/app/lib/auth-guard'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()
    if (!isTrainerRole(ctx.role)) return forbidden()

    const { searchParams } = new URL(request.url)
    const workoutId = searchParams.get('workoutId')
    
    if (!workoutId) {
      return NextResponse.json({ error: 'Missing workoutId' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // Get workout with exercises and sets — join up to the owning program's
    // organization_id for the tenant check. Audit fix (2026-08-26): this
    // route was gated by isTrainerRole only, so any trainer could read any
    // org's workout template by guessing a workoutId. Now scope to the
    // caller's effective org.
    const { data: workout, error } = await adminClient
      .from('program_workouts')
      .select(`
        id,
        name,
        programs!inner ( organization_id ),
        workout_exercises (
          id,
          exercise_name,
          order_index,
          exercise_sets (
            set_number,
            reps,
            intensity_type,
            intensity_value
          )
        )
      `)
      .eq('id', workoutId)
      .single()

    if (error) {
      console.error('Error fetching workout preview:', error)
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 })
    }

    const owningOrg = (workout.programs as unknown as { organization_id: string } | { organization_id: string }[] | null)
    const orgId = Array.isArray(owningOrg) ? owningOrg[0]?.organization_id : owningOrg?.organization_id
    if (ctx.role !== 'super_admin') {
      const effectiveOrg = await getEffectiveOrgIdStrict(ctx)
      if (!orgId || orgId !== effectiveOrg) return forbidden()
    }

    // Transform to simpler format
    const exercises = (workout.workout_exercises || [])
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((ex: any) => ({
        name: ex.exercise_name,
        sets: (ex.exercise_sets || [])
          .sort((a: any, b: any) => a.set_number - b.set_number)
          .map((s: any) => ({
            set_number: s.set_number,
            reps: s.reps,
            intensity: s.intensity_type === 'rir' 
              ? `${s.intensity_value} RIR` 
              : s.intensity_type === 'rpe'
              ? `RPE ${s.intensity_value}`
              : s.intensity_type === 'percentage'
              ? `${s.intensity_value}%`
              : s.intensity_type === 'failure'
              ? 'To Failure'
              : s.intensity_value
          }))
      }))

    return NextResponse.json({
      workout: {
        id: workout.id,
        name: workout.name,
        exercises
      }
    })

  } catch (error) {
    console.error('Coaching preview error:', error)
    return NextResponse.json({ error: 'Failed to fetch workout preview' }, { status: 500 })
  }
}
