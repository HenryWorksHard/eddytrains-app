import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/app/lib/supabase/server'
import { getEffectiveOrgId } from '@/app/lib/org-context'

export async function GET(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Verify user is authenticated
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin/trainer/super_admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile?.role || !['admin', 'trainer', 'super_admin', 'company_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Audit fix (2026-08-26): this listed EVERY program in the database
    // across every organisation, on the service-role client. Any trainer in
    // any org could read another org's whole program library. Scope it to the
    // caller's effective org (super admins still resolve through the
    // impersonation cookie, so they can inspect a specific org, not all of
    // them at once).
    const organizationId = await getEffectiveOrgId()
    if (!organizationId) {
      return NextResponse.json({ programs: [] })
    }

    const { data: programs, error } = await supabaseAdmin
      .from('programs')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching programs:', error)
      throw error
    }

    return NextResponse.json({ programs: programs || [] })

  } catch (error) {
    console.error('Error listing programs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list programs' },
      { status: 500 }
    )
  }
}
