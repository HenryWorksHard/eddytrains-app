import { getVerifiedUser } from '@/app/lib/auth-claims'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/app/lib/supabase/server'

// Fire-and-forget client-side diagnostic events for the workout autosave
// path. Shipped 2026-08-17 to diagnose why ~88% of completed workouts land
// with zero set_logs. The autosave is failing somewhere on the client
// before ever hitting Supabase — no server logs to look at. This endpoint
// lets the WorkoutClient POST what happened during each save cycle so we
// can query the client_diagnostic_events table to see the real failure
// mode.
//
// Semantics:
// - Auth-optional (client fires-and-forgets, don't 401 them out of the
//   telemetry loop just because their token expired).
// - We resolve user_id from the session if available; otherwise we drop
//   the event silently (better than storing anonymous rows we can't map).
// - Best-effort insert — we never surface errors to the client. This
//   endpoint should NEVER be able to break the workout flow.

type DiagnosticEvent = {
  event_type: 'save_attempt' | 'save_success' | 'save_failure' | 'flush_before_complete'
  workout_id?: string | null
  workout_log_id?: string | null
  scheduled_date?: string | null
  n_pending_rows?: number | null
  n_rows_saved?: number | null
  error_code?: string | null
  error_message?: string | null
  context?: Record<string, unknown>
}

const ALLOWED_TYPES = new Set<DiagnosticEvent['event_type']>([
  'save_attempt',
  'save_success',
  'save_failure',
  'flush_before_complete',
])

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getVerifiedUser(supabase)
    if (!user) {
      // Drop silently — we don't want to burn 401s on telemetry.
      return NextResponse.json({ ok: true, dropped: 'no_user' })
    }

    let body: DiagnosticEvent | null = null
    try {
      body = (await req.json()) as DiagnosticEvent
    } catch {
      return NextResponse.json({ ok: true, dropped: 'bad_json' })
    }

    if (!body || !body.event_type || !ALLOWED_TYPES.has(body.event_type)) {
      return NextResponse.json({ ok: true, dropped: 'invalid_event_type' })
    }

    // Best-effort insert. If it fails we don't care — never bubble up.
    try {
      await getSupabaseAdmin()
        .from('client_diagnostic_events')
        .insert({
          user_id: user.id,
          event_type: body.event_type,
          workout_id: body.workout_id ?? null,
          workout_log_id: body.workout_log_id ?? null,
          scheduled_date: body.scheduled_date ?? null,
          n_pending_rows: typeof body.n_pending_rows === 'number' ? body.n_pending_rows : null,
          n_rows_saved: typeof body.n_rows_saved === 'number' ? body.n_rows_saved : null,
          error_code: body.error_code ?? null,
          // Truncate to 2000 chars so a huge stack trace can't bloat the table.
          error_message: body.error_message ? String(body.error_message).slice(0, 2000) : null,
          context: body.context ?? {},
        })
    } catch (e) {
      console.error('[client-diagnostic] insert failed:', e)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[client-diagnostic] unexpected error:', e)
    // Even at the top level — never fail loudly.
    return NextResponse.json({ ok: true })
  }
}
