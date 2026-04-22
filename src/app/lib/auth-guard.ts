import { createClient } from './supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

type Role = 'client' | 'trainer' | 'admin' | 'company_admin' | 'super_admin'

export type AuthContext = {
  userId: string
  role: Role | null
  organizationId: string | null
  email: string | null
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(url, key)
}

/**
 * Resolves the authenticated user via cookie OR X-Supabase-Auth header (Capacitor).
 * Returns null if unauthenticated. Uses admin client to fetch profile (bypasses RLS).
 * NEVER throws — callers handle the null case.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const headerStore = await headers()
  const authToken = headerStore.get('x-supabase-auth')
  let userId: string | null = null
  let email: string | null = null

  if (authToken) {
    try {
      const admin = getAdminClient()
      const { data } = await admin.auth.getUser(authToken)
      userId = data?.user?.id ?? null
      email = data?.user?.email ?? null
    } catch { /* fall through */ }
  } else {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    userId = data?.user?.id ?? null
    email = data?.user?.email ?? null
  }

  if (!userId) return null

  const admin = getAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, organization_id')
    .eq('id', userId)
    .single()

  return {
    userId,
    role: (profile?.role as Role) ?? null,
    organizationId: profile?.organization_id ?? null,
    email,
  }
}

/** Response helper — unauthorized (no user) */
export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/** Response helper — forbidden (user exists but lacks permission) */
export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/** True if role is a trainer-side role (any role that can administer clients) */
export function isTrainerRole(role: Role | null | undefined): boolean {
  return role === 'trainer' || role === 'admin' || role === 'company_admin' || role === 'super_admin'
}

/**
 * Convenience: fetch a target profile and decide access in one step.
 * Returns { allowed, profile } — profile is null if the user doesn't exist.
 */
export async function authorizeUserAccess(
  ctx: AuthContext,
  targetUserId: string
): Promise<{ allowed: boolean; profile: { id: string; organization_id: string | null } | null }> {
  const admin = getAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id, organization_id')
    .eq('id', targetUserId)
    .single()
  if (!profile) return { allowed: false, profile: null }
  return {
    allowed: canAccessUser(ctx, { id: profile.id, organization_id: profile.organization_id }),
    profile,
  }
}

/**
 * True if caller is allowed to access/modify the target user.
 * - super_admin: always yes
 * - same-org trainer-role: yes
 * - self: yes (caller.userId === targetUserId)
 */
export function canAccessUser(
  ctx: AuthContext,
  target: { id: string; organization_id: string | null }
): boolean {
  if (ctx.role === 'super_admin') return true
  if (ctx.userId === target.id) return true
  if (isTrainerRole(ctx.role) && ctx.organizationId && ctx.organizationId === target.organization_id) return true
  return false
}

/** Resolve the effective organization id with impersonation — only super_admins honor the cookie */
export async function getEffectiveOrgIdStrict(ctx: AuthContext): Promise<string | null> {
  const { cookies } = await import('next/headers')
  const { IMPERSONATION_COOKIE, verifyImpersonationCookie } = await import('./impersonation')
  const cookieStore = await cookies()
  const raw = cookieStore.get(IMPERSONATION_COOKIE)?.value
  if (raw && ctx.role === 'super_admin') {
    const orgId = verifyImpersonationCookie(raw)
    if (orgId) return orgId
  }
  return ctx.organizationId
}
