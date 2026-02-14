import { createClient } from './supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { headers } from 'next/headers'

export const IMPERSONATION_COOKIE = 'impersonating_org'

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
 * Checks for impersonation cookie first (for super admins viewing as trainers),
 * then falls back to the user's own organization_id.
 * 
 * Supports both cookie-based auth AND header-based auth (X-Supabase-Auth)
 * for Capacitor/WKWebView compatibility.
 */
export async function getEffectiveOrgId(): Promise<string | null> {
  const cookieStore = await cookies()
  const headerStore = await headers()
  
  // Check for impersonation first
  const impersonatingOrg = cookieStore.get(IMPERSONATION_COOKIE)?.value
  if (impersonatingOrg) {
    console.log('[getEffectiveOrgId] Using impersonation org:', impersonatingOrg)
    return impersonatingOrg
  }
  
  // Check for auth token in header (Capacitor/WKWebView fallback)
  const authToken = headerStore.get('x-supabase-auth')
  
  let user = null
  let authError = null
  
  if (authToken) {
    // Use admin client to verify the token and get user
    console.log('[getEffectiveOrgId] Using header-based auth')
    try {
      const adminClient = getAdminClient()
      const { data, error } = await adminClient.auth.getUser(authToken)
      user = data?.user
      authError = error
    } catch (e) {
      console.error('[getEffectiveOrgId] Admin client error:', e)
    }
  } else {
    // Fall back to cookie-based auth
    console.log('[getEffectiveOrgId] Using cookie-based auth')
    const supabase = await createClient()
    const result = await supabase.auth.getUser()
    user = result.data?.user
    authError = result.error
  }
  
  console.log('[getEffectiveOrgId] Auth result:', { userId: user?.id, error: authError?.message, method: authToken ? 'header' : 'cookie' })
  
  if (!user) {
    console.log('[getEffectiveOrgId] No user found')
    return null
  }
  
  // Use admin client to fetch profile (bypasses RLS)
  try {
    const adminClient = getAdminClient()
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()
    
    console.log('[getEffectiveOrgId] Profile result:', { orgId: profile?.organization_id, error: profileError?.message })
    
    return profile?.organization_id || null
  } catch (e) {
    console.error('[getEffectiveOrgId] Profile fetch error:', e)
    return null
  }
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
