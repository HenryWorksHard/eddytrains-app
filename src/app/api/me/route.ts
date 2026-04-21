import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { IMPERSONATION_COOKIE } from '@/app/lib/org-context'

// Admin client for bypassing RLS
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const adminClient = getAdminClient()
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, organization_id, company_id, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('[API /me] Profile error:', profileError?.message)
      return NextResponse.json({
        error: 'Profile not found',
        userId: user.id,
        email: user.email
      }, { status: 404 })
    }

    // Impersonation context — only super_admins can impersonate, but we read
    // the cookie either way so a stale cookie on a non-super-admin is ignored.
    const cookieStore = await cookies()
    const impersonatingOrgId = cookieStore.get(IMPERSONATION_COOKIE)?.value || null
    const canImpersonate = profile.role === 'super_admin'

    let impersonating: { orgId: string; orgName: string } | null = null
    let effectiveOrgId: string | null = profile.organization_id

    if (impersonatingOrgId && canImpersonate) {
      const { data: impersonatedOrg } = await adminClient
        .from('organizations')
        .select('id, name')
        .eq('id', impersonatingOrgId)
        .single()
      if (impersonatedOrg) {
        impersonating = { orgId: impersonatedOrg.id, orgName: impersonatedOrg.name }
        effectiveOrgId = impersonatedOrg.id
      }
    }

    // Resolve the effective org's display name
    let orgName = 'CMPD'
    if (effectiveOrgId) {
      const { data: org } = await adminClient
        .from('organizations')
        .select('name')
        .eq('id', effectiveOrgId)
        .single()
      if (org?.name) orgName = org.name
    }

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      role: profile.role,
      // organizationId is the EFFECTIVE org (impersonated if applicable).
      // Clients should use this for scoping. userOrganizationId is the raw profile value.
      organizationId: effectiveOrgId,
      userOrganizationId: profile.organization_id,
      companyId: profile.company_id,
      fullName: profile.full_name,
      orgName,
      impersonating,
    })
  } catch (error) {
    console.error('[API /me] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
