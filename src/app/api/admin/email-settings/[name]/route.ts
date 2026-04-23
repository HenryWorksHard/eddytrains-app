import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext, unauthorized, forbidden } from '@/app/lib/auth-guard'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const ctx = await getAuthContext()
  if (!ctx) return unauthorized()
  if (ctx.role !== 'super_admin') return forbidden()

  const { name } = await params
  let body: { enabled?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
  }

  const admin = getAdminClient()
  const { data, error } = await admin
    .from('email_template_settings')
    .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
    .eq('name', name)
    .select('name, enabled, description, updated_at')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }
  return NextResponse.json({ data })
}
