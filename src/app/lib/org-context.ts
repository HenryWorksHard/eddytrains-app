import { createClient } from './supabase/server'
import { cookies } from 'next/headers'

export const IMPERSONATION_COOKIE = 'impersonating_org'

/**
 * Get the effective organization ID for the current context.
 * Checks for impersonation cookie first (for super admins viewing as trainers),
 * then falls back to the user's own organization_id.
 */
export async function getEffectiveOrgId(): Promise<string | null> {
  const cookieStore = await cookies()
  
  // Check for impersonation first
  const impersonatingOrg = cookieStore.get(IMPERSONATION_COOKIE)?.value
  if (impersonatingOrg) {
    return impersonatingOrg
  }
  
  // Fall back to user's own organization
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  
  return profile?.organization_id || null
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
