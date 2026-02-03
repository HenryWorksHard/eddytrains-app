import { createClient } from './supabase/server'
import { redirect } from 'next/navigation'

export interface UserPermissions {
  can_access_strength: boolean
  can_access_cardio: boolean
  can_access_hyrox: boolean
  can_access_nutrition: boolean
  role: string
}

/**
 * Get user permissions from the profiles table.
 * Returns null if user is not authenticated.
 */
export async function getUserPermissions(): Promise<UserPermissions | null> {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, can_access_strength, can_access_cardio, can_access_hyrox, can_access_nutrition')
    .eq('id', user.id)
    .single()
  
  if (!profile) return null
  
  return {
    role: profile.role || 'user',
    can_access_strength: profile.can_access_strength ?? false,
    can_access_cardio: profile.can_access_cardio ?? false,
    can_access_hyrox: profile.can_access_hyrox ?? false,
    can_access_nutrition: profile.can_access_nutrition ?? false,
  }
}

/**
 * Check if user has access to a specific feature.
 * Admins always have access to everything.
 */
export function hasAccess(permissions: UserPermissions | null, feature: keyof Omit<UserPermissions, 'role'>): boolean {
  if (!permissions) return false
  if (permissions.role === 'admin') return true
  return permissions[feature] === true
}

/**
 * Require a specific permission or redirect to dashboard with error.
 * Use in server components at the top of the page.
 */
export async function requirePermission(feature: keyof Omit<UserPermissions, 'role'>, redirectTo = '/dashboard') {
  const permissions = await getUserPermissions()
  
  if (!permissions) {
    redirect('/login')
  }
  
  if (!hasAccess(permissions, feature)) {
    redirect(`${redirectTo}?error=no_access&feature=${feature}`)
  }
  
  return permissions
}

/**
 * Check if user is admin.
 */
export async function requireAdmin(redirectTo = '/dashboard') {
  const permissions = await getUserPermissions()
  
  if (!permissions) {
    redirect('/login')
  }
  
  if (permissions.role !== 'admin') {
    redirect(redirectTo)
  }
  
  return permissions
}
