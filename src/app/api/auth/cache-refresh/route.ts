import { NextResponse } from 'next/server'

/**
 * Clears the middleware's profile cache cookie.
 * Called by pages that mutate a profile field the middleware reads
 * (password_changed, role, organization_id, subscription status).
 */
export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('cmpd-profile-cache')
  return response
}
