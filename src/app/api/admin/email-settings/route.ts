import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthContext, unauthorized, forbidden } from '@/app/lib/auth-guard'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return unauthorized()
  if (ctx.role !== 'super_admin') return forbidden()

  const admin = getAdminClient()
  const { data, error } = await admin
    .from('email_template_settings')
    .select('name, enabled, description, updated_at')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data: data ?? [] })
}
