import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized, forbidden, isTrainerRole, getEffectiveOrgIdStrict } from '@/app/lib/auth-guard'
import { grantPurchasedProgram } from '@/app/lib/grant-program'

/**
 * Grants a catalog program to a client as a purchase, computing the access
 * window from the program's real schedule.
 *
 * Trainer-only for now, so Eddy can comp someone a program and so the whole
 * purchase path can be exercised before Stripe exists. When the webhook lands
 * it calls grantPurchasedProgram directly rather than going through here.
 */
export async function POST(request: NextRequest) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()
    if (!isTrainerRole(ctx.role)) return forbidden()

    const { clientId, slug, purchaseDate } = await request.json()
    if (!clientId || !slug) {
      return NextResponse.json({ error: 'clientId and slug are required' }, { status: 400 })
    }

    const organizationId = await getEffectiveOrgIdStrict(ctx)
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization in context' }, { status: 400 })
    }

    // Don't let a trainer grant across an org boundary.
    const { data: client } = await admin
      .from('profiles')
      .select('id, organization_id, role')
      .eq('id', clientId)
      .maybeSingle()

    if (!client || client.role !== 'client') {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    if (ctx.role !== 'super_admin' && client.organization_id !== organizationId) {
      return forbidden()
    }

    const result = await grantPurchasedProgram(admin, {
      clientId,
      slug,
      organizationId,
      purchaseDate,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Grant program error:', error)
    return NextResponse.json({ error: 'Failed to grant program' }, { status: 500 })
  }
}
