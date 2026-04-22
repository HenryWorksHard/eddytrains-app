import { createClient } from './supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { headers } from 'next/headers'
import { IMPERSONATION_COOKIE, verifyImpersonationCookie } from './impersonation'

// Re-export so existing imports from org-context keep working.
export { IMPERSONATION_COOKIE }

// Lazy admin client creation to avoid build-time errors
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase env vars not available')
  }
  return createSupabaseClient(url, key)
}

/**
 * Get the effective organization ID for the current context.
 * - Impersonation cookie is honored ONLY when the caller's role is super_admin
 *   AND the cookie's HMAC signature verifies.
 * - Falls back to the user's own organization_id otherwise.
 *
 * Supports both cookie-based auth AND header-based auth (X-Supabase-Auth)
 * for Capacitor/WKWebView compatibility.
 */
export async function getEffectiveOrgId(): Promise<string | null> {
  const cookieStore = await cookies()
  const headerStore = await headers()

  // Check for auth token in header (Capacitor/WKWebView fallback) vs cookie.
  const authToken = headerStore.get('x-supabase-auth')

  let user = null

  if (authToken) {
    try {
      const adminClient = getAdminClient()
      const { data } = await adminClient.auth.getUser(authToken)
      user = data?.user ?? null
    } catch (e) {
      console.error('[getEffectiveOrgId] Admin client error:', e)
    }
  } else {
    const supabase = await createClient()
    const result = await supabase.auth.getUser()
    user = result.data?.user ?? null
  }

  if (!user) {
    return null
  }

  // Resolve the user's profile to know their own org AND their role.
  type UserProfile = { organization_id: string | null; role: string | null }
  let userProfile: UserProfile | null = null
  try {
    const adminClient = getAdminClient()
    const { data: profile } = await adminClient
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()
    userProfile = (profile as UserProfile) ?? null
  } catch (e) {
    console.error('[getEffectiveOrgId] Profile fetch error:', e)
    return null
  }

  // Honor impersonation ONLY for super_admins with a valid signed cookie.
  const rawCookie = cookieStore.get(IMPERSONATION_COOKIE)?.value
  if (rawCookie && userProfile?.role === 'super_admin') {
    const impersonatedOrg = await verifyImpersonationCookie(rawCookie)
    if (impersonatedOrg) {
      return impersonatedOrg
    }
  }

  return userProfile?.organization_id || null
}

/**
 * Check if the current user is a super admin
 */
export async function isSuperAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'super_admin'
}
