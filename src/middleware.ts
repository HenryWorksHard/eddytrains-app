import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { signPayload, verifyPayload } from '@/app/lib/impersonation'
import { getVerifiedUser } from '@/app/lib/auth-claims'

// Short-lived cookie that caches the middleware-relevant profile fields.
// Skips the DB roundtrip on most requests — session verification already runs
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
  // Audit fix (2026-08-23): bind cache to the authenticated user id. Prior
  // to this, if User A signed out on a shared browser and User B signed
  // in within 60s (cache TTL), the middleware's readCache accepted A's
  // still-signed payload for B — B inherited A's role, organization_id,
  // and access_paused for up to 60s. On shared devices / trainer laptops
  // this was a silent privilege confusion. Sign-out also now clears this
  // cookie via /api/auth/sign-out-cleanup, but the userId check is the
  // defense-in-depth layer.
  userId: string
  // Re-audit fix (2026-08-26): issued-at (epoch ms). The signed payload
  // is valid forever cryptographically, and the browser-honored maxAge=60
  // is not enforced server-side — so a paused / role-demoted / trial-
  // expired user could REPLAY their old cookie from any HTTP client and
  // the middleware would trust access_paused:false indefinitely, defeating
  // the very pause gate. readCache now rejects payloads older than the TTL.
  iat: number
  password_changed: boolean | null
  role: string | null
  organization_id: string | null
  subscription_status: string | null
  trial_ends_at: string | null
  access_paused: boolean | null
}

async function readCache(request: NextRequest, expectedUserId: string): Promise<CachedProfile | null> {
  const raw = request.cookies.get(PROFILE_CACHE_COOKIE)?.value
  if (!raw) return null
  // Signed-cookie path: `${base64url(json)}.${hmac}`. On signature failure,
  // treat as cache miss rather than trusting tampered content.
  const verified = await verifyPayload(raw)
  if (!verified) return null
  try {
    const parsed = JSON.parse(verified) as CachedProfile
    // Reject stale cache belonging to a different user.
    if (parsed.userId !== expectedUserId) return null
    // Server-enforced TTL (replay protection): ignore payloads older than
    // the cache window regardless of the browser-set maxAge.
    if (typeof parsed.iat !== 'number' || Date.now() - parsed.iat > PROFILE_CACHE_TTL_SECONDS * 1000) {
      return null
    }
    return parsed
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

// Timeout guard for the middleware's upstream calls (Supabase auth +
// profile/org queries). Prod incident (observed ~Aug 18-25, 2026): when
// Supabase was slow/unreachable, these awaited fetches hung until
// Vercel's middleware limit → 504 MIDDLEWARE_INVOCATION_TIMEOUT on
// EVERY route → whole site down. Now each upstream call races a timeout;
// on timeout we FAIL OPEN (skip middleware gating and pass the request
// through). Every role-sensitive page and API route re-checks auth
// server-side (auth-guard.ts / per-page checks), so failing open here
// degrades UX gates, not security.
const TIMED_OUT = Symbol('timed_out')
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  return Promise.race([
    p,
    new Promise<typeof TIMED_OUT>((resolve) => setTimeout(() => resolve(TIMED_OUT), ms)),
  ])
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

  // Session verified locally against the project's ES256 public key instead
  // of a round trip to the auth server on every request (see lib/auth-claims).
  // Expired sessions are still refreshed first, and the cookie writes land on
  // supabaseResponse exactly as before.
  const authResult = await withTimeout(getVerifiedUser(supabase), 5000)
  if (authResult === TIMED_OUT) {
    console.error('[middleware] session verification timed out — failing open')
    return supabaseResponse
  }
  const user = authResult

  const pathname = request.nextUrl.pathname

  // /update-password is public so the recovery-link landing page can
  // load while the Supabase JS client processes the recovery token from
  // the URL hash. /api/auth/send-password-reset must also be public —
  // a forgotten-password submission obviously runs while logged out.
  const publicRoutes = ['/login', '/signup', '/api/signup', '/reset-password', '/update-password', '/auth/callback', '/join', '/api/exercises', '/accept-invite', '/api/accept-invite', '/api/auth/send-password-reset', '/api/auth/sign-out-cleanup', '/api/log/client-diagnostic', '/privacy', '/access-paused']
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

  // Everything below needs the profile. update-password runs its own
  // recovery-session flow so we skip it here.
  if (!user || pathname.startsWith('/update-password')) {
    return supabaseResponse
  }

  // Fetch profile for BOTH pages and API routes. The cache TTL (60s) keeps
  // this cheap. Audit fix (2026-08-23): previously we short-circuited
  // /api/* here, which meant the access_paused gate below only ran for
  // page navigations. Paused clients could keep POSTing to /api/log,
  // /api/workouts/complete, /api/dashboard etc. via the mobile app — the
  // whole "lock out unpaid clients" feature was nullified for API traffic.
  let profile = await readCache(request, user.id)

  if (!profile) {
    const profileResult = await withTimeout(
      (async () =>
        await supabase
          .from('profiles')
          .select('password_changed, role, organization_id, access_paused')
          .eq('id', user.id)
          .single())(),
      4000,
    )
    if (profileResult === TIMED_OUT) {
      console.error('[middleware] profile fetch timed out — failing open')
      return supabaseResponse
    }
    const { data } = profileResult

    if (!data) {
      return supabaseResponse
    }

    // For admin roles we also need trial status. Fetch alongside so the
    // next cached 60 seconds include it.
    const adminRoles = ['trainer', 'admin', 'company_admin', 'super_admin']
    let subscription_status: string | null = null
    let trial_ends_at: string | null = null
    if (data.organization_id && adminRoles.includes(data.role || '')) {
      const orgResult = await withTimeout(
        (async () =>
          await supabase
            .from('organizations')
            .select('subscription_status, trial_ends_at')
            .eq('id', data.organization_id)
            .single())(),
        4000,
      )
      if (orgResult === TIMED_OUT) {
        console.error('[middleware] org fetch timed out — failing open')
        return supabaseResponse
      }
      const { data: org } = orgResult
      subscription_status = org?.subscription_status ?? null
      trial_ends_at = org?.trial_ends_at ?? null
    }

    profile = {
      userId: user.id,
      iat: Date.now(),
      password_changed: data.password_changed ?? null,
      role: data.role ?? null,
      organization_id: data.organization_id ?? null,
      subscription_status,
      trial_ends_at,
      access_paused: data.access_paused ?? false,
    }

    await writeCache(supabaseResponse, profile)
  }

  const role = profile.role || 'client'
  const isApiRoute = pathname.startsWith('/api')

  // Client access pause — trainer can lock out unpaid clients without
  // affecting the org's other clients or the trainer's subscription.
  // Enforced BEFORE any /api short-circuit so the mobile app can't
  // keep POSTing set_logs / completions after being paused.
  if (role === 'client' && profile.access_paused) {
    if (isApiRoute) {
      // Allow /api/auth/* for sign-out flows; block everything else with
      // a JSON 403 so client-side fetch handlers can surface a clean
      // "your access is paused" message instead of getting HTML.
      if (!pathname.startsWith('/api/auth')) {
        return NextResponse.json(
          { error: 'access_paused', message: 'Your access is currently paused. Contact your trainer.' },
          { status: 403 },
        )
      }
    } else if (
      !pathname.startsWith('/access-paused') &&
      !pathname.startsWith('/login')
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/access-paused'
      return NextResponse.redirect(url)
    }
  }

  // Below this line is page-only (password-reset redirect, role gating,
  // trial expiry redirect). API routes short-circuit here — those checks
  // don't apply to API traffic and each route self-guards via
  // getAuthContext for what it does need.
  if (isApiRoute) {
    return supabaseResponse
  }

  // Force password reset if the client hasn't set theirs yet.
  if (profile.password_changed === false) {
    const url = request.nextUrl.clone()
    url.pathname = '/update-password'
    url.searchParams.set('required', 'true')
    return NextResponse.redirect(url)
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

    // Audit fix (2026-08-23): previously only fired if trial_ends_at was
    // truthy AND < now(). A trialing org with trial_ends_at=NULL had no
    // gate at all — a manual DB fix or a buggy Stripe webhook path that
    // nulled the column yielded a permanent free tier. Treat null as
    // "expired" so any drift lands the trainer on /billing instead of
    // giving unlimited access.
    if (profile.subscription_status === 'trialing') {
      const trialEnd = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null
      if (!trialEnd || trialEnd < new Date()) {
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
    // Static files never need a session check. Fonts, the web manifest and
    // other assets used to run full auth verification on every request.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|json|webmanifest|txt|xml|woff|woff2|ttf|otf|mp4|webm|mp3)$).*)',
  ],
}
