import type { SupabaseClient } from '@supabase/supabase-js'

// Central sign-out helper. Wraps supabase.auth.signOut() with a follow-up
// POST to /api/auth/sign-out-cleanup that clears the two HttpOnly cookies
// supabase can't touch: the impersonation cookie (24h) and the profile
// cache cookie (60s). Both would otherwise survive sign-out and leak
// state to whoever signs in next on the same browser (audit fix,
// 2026-08-23).
//
// Every place that used to call supabase.auth.signOut() directly should
// call this instead. Fire-and-forget on the cleanup fetch — even if it
// fails, the middleware's userId-check on the cache cookie (added in the
// same audit fix) prevents cross-user leaks. But we try to clean up
// server-side too so subsequent nav is snappier.
export async function signOutAndClear(supabase: SupabaseClient): Promise<void> {
  try {
    await supabase.auth.signOut()
  } catch (e) {
    console.error('[signOutAndClear] supabase.auth.signOut failed:', e)
  }
  try {
    await fetch('/api/auth/sign-out-cleanup', {
      method: 'POST',
      // keepalive lets the request survive navigation — many callers
      // immediately redirect to /login after this.
      keepalive: true,
    })
  } catch (e) {
    console.error('[signOutAndClear] cleanup fetch failed:', e)
  }
}
