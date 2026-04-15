import { createClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { timezone } = await request.json()

  // Basic validation: must be a non-empty string
  if (!timezone || typeof timezone !== 'string') {
    return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 })
  }

  await supabase
    .from('profiles')
    .update({ timezone })
    .eq('id', user.id)

  return NextResponse.json({ ok: true })
}
