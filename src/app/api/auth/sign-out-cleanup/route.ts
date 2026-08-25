import { NextResponse } from 'next/server'

// Server-side cleanup of HttpOnly cookies that supabase.auth.signOut()
// doesn't touch: the impersonation cookie (24h TTL, super-admin scope)
// and the profile-cache cookie (60s TTL, all roles). Sign-out callers
// invoke this immediately after their client-side signOut() so the next
// request from the same browser starts fresh.
//
// Audit fix (2026-08-23):
//   - Impersonation cookie survived sign-out → next super-admin who
//     signed in on the same browser inherited the impersonation.
//   - Profile-cache cookie survived sign-out → next user (any role) on
//     the same browser inherited the outgoing user's role / org /
//     access_paused for up to 60s.
//
// Public endpoint — deliberately no auth check. The user is already
// signed out by the time this fires; requiring auth would leave the
// cookies orphaned. Worst-case abuse is someone forcing another user
// to lose their cache cookie → 60ms of extra latency next nav. Not a
// meaningful attack surface.

export async function POST() {
  const response = NextResponse.json({ ok: true })
  // Delete both cookies. maxAge=0 + expires-past coerces every UA to
  // drop them regardless of the original set attributes.
  response.cookies.set('cmpd-profile-cache', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
    expires: new Date(0),
  })
  response.cookies.set('impersonating_org', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
    expires: new Date(0),
  })
  return response
}
