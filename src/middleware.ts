import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { signPayload, verifyPayload } from '@/app/lib/impersonation'

// Short-lived cookie that caches the middleware-relevant profile fields.
// Skips the DB roundtrip on most requests — auth.getUser() already runs
// on every call, adding a profiles query + an organizations query meant
// every navigation paid a 200-400ms cost on mobile networks.
//
// Defense-in-depth: this cookie is a PERFORMANCE optimization only. Every
// role-sensitive page (src/app/platform/layout.tsx, src/app/api/trainers/*
// DELETE/GET, getEffectiveOrgId, etc.) re-checks role via the admin DB
// client. Tampering with this cookie lets an attacker BYPASS a redirect,
// not access data they shouldn't.
const PROFILE_CACHE_COOKIE = 'cmpd-profile-cache'
const PROFILE_CACHE_TTL_SECONDS = 60

type CachedProfile = {
  password_changed: boolean | null
  role: string | null
  organization_id: string | null
  subscription_status: string | null
  trial_ends_at: string | null
  access_paused: boolean | null
}

async function readCache(request: NextRequest): Promise<CachedProfile | null> {
  const raw = request.cookies.get(PROFILE_CACHE_COOKIE)?.value
  if (!raw) return null
  // Signed-cookie path: `${base64url(json)}.${hmac}`. On signature failure,
  // treat as cache miss rather than trusting tampered content.
  const verified = await verifyPayload(raw)
  if (!verified) return null
  try {
    return JSON.parse(verified) as CachedProfile
  } catch {
    return null
  }
}

async function writeCache(response: NextResponse, data: CachedProfile) {
  const signed = await signPayload(JSON.stringify(data))
  response.cookies.set(PROFILE_CACHE_COOKIE, signed, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: PROFILE_CACHE_TTL_SECONDS,
    path: '/',
  })
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const publicRoutes = ['/login', '/signup', '/reset-password', '/auth/callback', '/join', '/api/exercises', '/accept-invite', '/api/accept-invite', '/privacy', '/access-paused']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Everything below needs the profile. Skip API routes and the update-password
  // page (which runs independently of the redirect-check).
  if (!user || pathname.startsWith('/update-password') || pathname.startsWith('/api')) {
    return supabaseResponse
  }

  // Try the cache first. On cache hit: zero DB roundtrips for this navigation.
  let profile = await readCache(request)

  if (!profile) {
    const { data } = await supabase
      .from('profiles')
      .select('password_changed, role, organization_id, access_paused')
      .eq('id', user.id)
      .single()

    if (!data) {
      return supabaseResponse
    }

    // For admin roles we also need trial status. Fetch alongside so the
    // next cached 60 seconds include it.
    const adminRoles = ['trainer', 'admin', 'company_admin', 'super_admin']
    let subscription_status: string | null = null
    let trial_ends_at: string | null = null
    if (data.organization_id && adminRoles.includes(data.role || '')) {
      const { data: org } = await supabase
        .from('organizations')
        .select('subscription_status, trial_ends_at')
        .eq('id', data.organization_id)
        .single()
      subscription_status = org?.subscription_status ?? null
      trial_ends_at = org?.trial_ends_at ?? null
    }

    profile = {
      password_changed: data.password_changed ?? null,
      role: data.role ?? null,
      organization_id: data.organization_id ?? null,
      subscription_status,
      trial_ends_at,
      access_paused: data.access_paused ?? false,
    }

    await writeCache(supabaseResponse, profile)
  }

  // Force password reset if the client hasn't set theirs yet.
  if (profile.password_changed === false) {
    const url = request.nextUrl.clone()
    url.pathname = '/update-password'
    url.searchParams.set('required', 'true')
    return NextResponse.redirect(url)
  }

  const role = profile.role || 'client'

  // Client access pause — trainer can lock out unpaid clients without
  // affecting the org's other clients or the trainer's subscription.
  // Has no effect on trainer/admin/super_admin roles.
  if (role === 'client' && profile.access_paused) {
    if (
      !pathname.startsWith('/access-paused') &&
      !pathname.startsWith('/login') &&
      !pathname.startsWith('/api/auth')
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/access-paused'
      return NextResponse.redirect(url)
    }
  }

  // Super-admin-only routes
  const superAdminRoutes = ['/platform']
  const isSuperAdminRoute = superAdminRoutes.some(route => pathname.startsWith(route))
  if (isSuperAdminRoute && role !== 'super_admin') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Admin/trainer-only routes
  const adminRoutes = ['/users', '/billing', '/organisation', '/company', '/schedules', '/alerts']
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))
  const adminRoles = ['trainer', 'admin', 'company_admin', 'super_admin']
  if (isAdminRoute && !adminRoles.includes(role)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Expired trial / canceled subscription — block admin-only features,
  // leave /billing accessible so they can resubscribe.
  const blockedWhenExpired = ['/users', '/schedules', '/organisation', '/alerts']
  const isBlockedPath = blockedWhenExpired.some(path => pathname.startsWith(path))

  if (isBlockedPath && profile.organization_id && adminRoles.includes(role)) {
    if (profile.subscription_status === 'canceled') {
      const url = request.nextUrl.clone()
      url.pathname = '/billing'
      url.searchParams.set('canceled', 'true')
      return NextResponse.redirect(url)
    }

    if (profile.subscription_status === 'trialing' && profile.trial_ends_at) {
      const trialEnd = new Date(profile.trial_ends_at)
      if (trialEnd < new Date()) {
        const url = request.nextUrl.clone()
        url.pathname = '/billing'
        url.searchParams.set('expired', 'true')
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
