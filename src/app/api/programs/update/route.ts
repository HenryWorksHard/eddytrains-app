import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized, forbidden, isTrainerRole, getEffectiveOrgIdStrict } from '@/app/lib/auth-guard'
import { resolveCatalogFields } from '@/app/lib/catalog'
import { saveProgramWorkouts } from '@/app/lib/program-save'

export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()
    if (!isTrainerRole(ctx.role)) return forbidden()

    const body = await request.json()
    const { id, name, description, category, difficulty, durationWeeks, isActive, workouts, programKind, slug } = body
    const catalogFields = resolveCatalogFields(programKind, slug)

    // Assert the target program belongs to caller's effective org.
    const { data: programRow } = await supabaseAdmin
      .from('programs')
      .select('organization_id')
      .eq('id', id)
      .single()
    if (!programRow) return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    const effectiveOrg = await getEffectiveOrgIdStrict(ctx)
    if (ctx.role !== 'super_admin' && programRow.organization_id !== effectiveOrg) {
      return forbidden()
    }

    // 1. Update the program metadata
    const { error: programError } = await supabaseAdmin
      .from('programs')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        category,
        difficulty,
        duration_weeks: durationWeeks,
        is_active: isActive,
        ...catalogFields,
      })
      .eq('id', id)

    if (programError) {
      console.error('Program update error:', programError)
      throw programError
    }

    // 2. Workouts, exercises, sets and finishers — see lib/program-save for
    // the rules. Same behaviour as the sequential loop it replaced, in a
    // handful of round trips instead of ~28 per workout.
    await saveProgramWorkouts(supabaseAdmin, id, workouts)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error updating program:', error)
    const errorMessage = error?.message || 'Failed to update program'
    const errorDetails = error?.details || error?.hint || ''
    const errorCode = error?.code || ''
    return NextResponse.json(
      { 
        error: `${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}${errorCode ? ` [${errorCode}]` : ''}`,
      },
      { status: 500 }
    )
  }
}
