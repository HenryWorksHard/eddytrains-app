import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getAuthContext, unauthorized } from '@/app/lib/auth-guard'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Self-service account deletion. Required for App Store compliance
 * (Apple Guideline 5.1.1(v)) for any app that supports account creation.
 *
 * Removes:
 *   1. Storage objects in profile-pictures/{uid}/* and progress-images/{uid}/*
 *   2. Trainer references on workout_logs (FK is NO ACTION; clear before
 *      deleting the user so the auth.users delete doesn't fail)
 *   3. The auth.users row — cascades to profiles → cascades to all
 *      client-owned tables (workout_logs, set_logs, completions, goals,
 *      streaks, programs, custom exercises, 1RMs, photos, notifications,
 *      skips, etc.) via the FK chain.
 *
 * Always returns ok on success; the client signs out + redirects to login.
 */
export async function DELETE() {
  const ctx = await getAuthContext()
  if (!ctx) return unauthorized()

  const userId = ctx.userId
  const admin = getAdminClient()

  try {
    // 1. Storage cleanup — list and remove the user's folders.
    for (const bucket of ['profile-pictures', 'progress-images'] as const) {
      try {
        const { data: files } = await admin.storage.from(bucket).list(userId, { limit: 1000 })
        if (files && files.length > 0) {
          const paths = files.map((f) => `${userId}/${f.name}`)
          await admin.storage.from(bucket).remove(paths)
        }
      } catch (e) {
        // Storage errors shouldn't block the deletion — log and continue.
        console.error(`[delete-account] storage cleanup failed for ${bucket}:`, e)
      }
    }

    // 2. Clear trainer_id references on workout_logs so the FK doesn't
    //    block the auth deletion (this FK is NO ACTION, not CASCADE).
    await admin
      .from('workout_logs')
      .update({ trainer_id: null })
      .eq('trainer_id', userId)

    // 3. Delete the auth user — cascades to profiles → cascades to data.
    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId)
    if (deleteErr) {
      console.error('[delete-account] deleteUser failed:', deleteErr)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[delete-account] unexpected error:', e)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
