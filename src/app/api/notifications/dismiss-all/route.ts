import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'

// Dismiss all notifications
export async function POST() {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('admin_notifications')
      .update({ 
        is_dismissed: true,
        updated_at: new Date().toISOString() 
      })
      .eq('is_dismissed', false)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to dismiss all notifications', details: String(error) },
      { status: 500 }
    )
  }
}
