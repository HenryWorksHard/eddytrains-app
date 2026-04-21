import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/app/lib/supabase/server'
import { deleteOrganizationCompletely } from '@/app/lib/delete-organization'

// DELETE /api/companies/[id] - Remove a company organization (and all its trainers, clients, data)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: companyId } = await params

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
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

    // Confirm it's actually a company (safety against using this to wipe solo trainer orgs)
    const { data: org } = await admin
      .from('organizations')
      .select('id, organization_type, name')
      .eq('id', companyId)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }
    if (org.organization_type !== 'company') {
      return NextResponse.json(
        { error: 'That organization is not a company. Use /api/trainers/[id] for solo trainers.' },
        { status: 400 }
      )
    }

    const result = await deleteOrganizationCompletely(admin, companyId)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, stage: result.stage },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Company "${org.name}" deleted`,
      warnings: result.warnings.length ? result.warnings : undefined,
    })
  } catch (error) {
    console.error('Error deleting company:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete company' },
      { status: 500 }
    )
  }
}
