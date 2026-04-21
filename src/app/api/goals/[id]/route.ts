import { createClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/** PATCH /api/goals/[id] — update title, target, date, current_value (custom), mark achieved, deactivate */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const allowed: Record<string, unknown> = {}
  if (typeof body.title === 'string') allowed.title = body.title.trim()
  if (body.metric !== undefined) allowed.metric = body.metric ? String(body.metric).trim() : null
  if (body.target_value !== undefined) allowed.target_value = body.target_value === null || body.target_value === '' ? null : Number(body.target_value)
  if (body.target_date !== undefined) allowed.target_date = body.target_date || null
  if (body.current_value !== undefined) allowed.current_value = Number(body.current_value)
  if (typeof body.is_active === 'boolean') allowed.is_active = body.is_active
  if (body.achieved === true) allowed.achieved_at = new Date().toISOString()
  if (body.achieved === false) allowed.achieved_at = null
  allowed.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('client_goals')
    .update(allowed)
    .eq('id', id)
    .eq('client_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('[goals] patch error:', error)
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 })
  }
  return NextResponse.json({ goal: data })
}

/** DELETE /api/goals/[id] */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('client_goals')
    .delete()
    .eq('id', id)
    .eq('client_id', user.id)

  if (error) {
    console.error('[goals] delete error:', error)
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
