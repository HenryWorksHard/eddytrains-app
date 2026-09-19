import { getVerifiedUser } from '@/app/lib/auth-claims'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/app/lib/supabase/server'
import { getEffectiveOrgId } from '@/app/lib/org-context'
import { resolveCatalogFields } from '@/app/lib/catalog'
import { saveProgramWorkouts } from '@/app/lib/program-save'

export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Verify user is authenticated and is admin
    const supabase = await createServerClient()
    const user = await getVerifiedUser(supabase)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.role || !['admin', 'trainer', 'super_admin', 'company_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Respect impersonation — a super admin acting as another org should
    // create programs inside that org, not their own.
    const effectiveOrgId = await getEffectiveOrgId()
    if (!effectiveOrgId) {
      return NextResponse.json({ error: 'No organization in context' }, { status: 400 })
    }

    const body = await request.json()
    const { name, description, category, difficulty, durationWeeks, isActive, workouts, programKind, slug } = body
    const catalogFields = resolveCatalogFields(programKind, slug)

    // 1. Create the program with organization_id
    const { data: program, error: programError } = await supabaseAdmin
      .from('programs')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        category,
        difficulty,
        duration_weeks: durationWeeks || 4,
        is_active: isActive,
        organization_id: effectiveOrgId,
        ...catalogFields,
      })
      .select()
      .single()

    if (programError) {
      console.error('Program create error:', programError)
      throw programError
    }

    // 2. Workouts, exercises, sets and finishers. A brand-new program is the
    // "every workout is new" case of the shared save, which writes it in a
    // handful of round trips instead of one per exercise and per set batch.
    // (It also keeps superset_group on finisher exercises, which this route
    // used to drop until the program was next edited.)
    if (workouts && workouts.length > 0 && program) {
      await saveProgramWorkouts(supabaseAdmin, program.id, workouts)
    }

    return NextResponse.json({ success: true, programId: program.id })

  } catch (error) {
    console.error('Error creating program:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create program' },
      { status: 500 }
    )
  }
}
