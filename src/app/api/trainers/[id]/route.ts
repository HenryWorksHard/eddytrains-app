import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/app/lib/supabase/server'
import { deleteOrganizationCompletely } from '@/app/lib/delete-organization'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function requireSuperAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, error: 'Unauthorized' }

  const admin = getAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    return { ok: false as const, status: 403, error: 'Forbidden - super_admin only' }
  }
  return { ok: true as const, admin }
}

// GET /api/trainers/[id] - Fetch a trainer profile (super_admin only).
// Returns profile + auth email + attached org + company + client list.
// Uses admin client so it works regardless of RLS.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: trainerId } = await params

    const auth = await requireSuperAdmin()
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const admin = auth.admin

    // Load profile
    const { data: trainerProfile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', trainerId)
      .single()

    if (profileError || !trainerProfile) {
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
    }
    if (trainerProfile.role !== 'trainer') {
      return NextResponse.json({ error: 'That user is not a trainer' }, { status: 400 })
    }

    // Auth email
    const { data: authUser } = await admin.auth.admin.getUserById(trainerId)
    const email = authUser?.user?.email || null

    // Organization (solo trainer's own org OR company org for company trainers)
    let organization: {
      id: string
      name: string
      subscription_tier: string | null
      subscription_status: string | null
      organization_type: string
      trial_ends_at: string | null
    } | null = null
    if (trainerProfile.organization_id) {
      const { data: org } = await admin
        .from('organizations')
        .select('id, name, subscription_tier, subscription_status, organization_type, trial_ends_at')
        .eq('id', trainerProfile.organization_id)
        .single()
      if (org) organization = org
    }

    // Company name (if trainer is under a company separate from their org)
    let companyName: string | null = null
    if (trainerProfile.company_id && trainerProfile.company_id !== trainerProfile.organization_id) {
      const { data: company } = await admin
        .from('organizations')
        .select('name')
        .eq('id', trainerProfile.company_id)
        .single()
      companyName = company?.name ?? null
    } else if (organization?.organization_type === 'company') {
      companyName = organization.name
    }

    // Clients assigned to this trainer (by trainer_id)
    const { data: clientProfiles } = await admin
      .from('profiles')
      .select('id, email, full_name, is_active, created_at, status')
      .eq('trainer_id', trainerId)
      .eq('role', 'client')
      .order('created_at', { ascending: false })

    const clients = (clientProfiles || []).map((c) => ({
      id: c.id,
      email: c.email,
      full_name: c.full_name,
      is_active: c.is_active,
      created_at: c.created_at,
      status: c.status,
    }))

    return NextResponse.json({
      trainer: {
        ...trainerProfile,
        email,
      },
      organization,
      companyName,
      clients,
    })
  } catch (error) {
    console.error('[GET /api/trainers/[id]]', error)
    return NextResponse.json({ error: 'Failed to fetch trainer' }, { status: 500 })
  }
}

// DELETE /api/trainers/[id] - Remove a trainer organization (and all its data)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: organizationId } = await params

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Require super_admin
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden - super_admin only' }, { status: 403 })
    }

    const result = await deleteOrganizationCompletely(admin, organizationId)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, stage: result.stage },
        { status: result.error === 'Organization not found' ? 404 : 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Trainer organization deleted',
      warnings: result.warnings.length ? result.warnings : undefined,
    })
  } catch (error) {
    console.error('Error deleting trainer/organization:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete trainer' },
      { status: 500 }
    )
  }
}
