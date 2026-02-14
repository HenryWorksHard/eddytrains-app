import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

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
    // Get current user from session
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Use admin client to get profile (bypasses RLS)
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

    // Get organization name
    let orgName = 'CMPD'
    if (profile.organization_id) {
      const { data: org } = await adminClient
        .from('organizations')
        .select('name, subscription_status, trial_ends_at, stripe_subscription_id, subscription_tier, organization_type')
        .eq('id', profile.organization_id)
        .single()
      
      if (org?.name) {
        orgName = org.name
      }
    }

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      role: profile.role,
      organizationId: profile.organization_id,
      companyId: profile.company_id,
      fullName: profile.full_name,
      orgName: orgName
    })
  } catch (error) {
    console.error('[API /me] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
