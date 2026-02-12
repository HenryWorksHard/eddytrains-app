import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'

// Update a notification (mark as read, dismiss, etc.)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = await createClient()

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.is_read !== undefined) {
      updateData.is_read = body.is_read
    }
    if (body.is_dismissed !== undefined) {
      updateData.is_dismissed = body.is_dismissed
    }

    const { error } = await supabase
      .from('admin_notifications')
      .update(updateData)
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update notification', details: String(error) },
      { status: 500 }
    )
  }
}

// Delete a notification
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('admin_notifications')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete notification', details: String(error) },
      { status: 500 }
    )
  }
}
