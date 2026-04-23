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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return unauthorized()
  if (ctx.role !== 'super_admin') return forbidden()

  const admin = getAdminClient()
  const { data, error } = await admin
    .from('email_config')
    .select('reply_to')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ reply_to: data?.reply_to ?? '' })
}

export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return unauthorized()
  if (ctx.role !== 'super_admin') return forbidden()

  let body: { reply_to?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const replyTo = typeof body.reply_to === 'string' ? body.reply_to.trim() : ''
  if (!EMAIL_RE.test(replyTo)) {
    return NextResponse.json({ error: 'reply_to must be a valid email' }, { status: 400 })
  }

  const admin = getAdminClient()
  const { data, error } = await admin
    .from('email_config')
    .update({ reply_to: replyTo, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('reply_to')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ reply_to: data?.reply_to ?? replyTo })
}
