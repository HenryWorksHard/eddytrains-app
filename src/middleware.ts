import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

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
          supabaseResponse = NextResponse.next({
            request,
          })
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

  // Public routes that don't need auth
  const publicRoutes = ['/login', '/signup', '/reset-password', '/auth/callback', '/join']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // Protected routes - redirect to login if not authenticated
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect logged in users away from login page
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Check if user needs to change password (skip for update-password page and API routes)
  if (user && !pathname.startsWith('/update-password') && !pathname.startsWith('/api')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('password_changed, role, organization_id')
      .eq('id', user.id)
      .single()
    
    // If password_changed is explicitly false, force password reset
    if (profile && profile.password_changed === false) {
      const url = request.nextUrl.clone()
      url.pathname = '/update-password'
      url.searchParams.set('required', 'true')
      return NextResponse.redirect(url)
    }

    // Role-based route protection
    const role = profile?.role || 'client'
    
    // Super admin routes - only super_admin can access
    const superAdminRoutes = ['/platform']
    const isSuperAdminRoute = superAdminRoutes.some(route => pathname.startsWith(route))
    if (isSuperAdminRoute && role !== 'super_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Admin/Trainer routes - trainers, admins, company_admins, super_admins can access
    const adminRoutes = ['/users', '/billing', '/organisation', '/company', '/schedules', '/alerts']
    const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))
    const adminRoles = ['trainer', 'admin', 'company_admin', 'super_admin']
    if (isAdminRoute && !adminRoles.includes(role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Check for expired trial - block access to features (but allow billing page)
    const blockedWhenExpired = ['/users', '/schedules', '/organisation', '/alerts']
    const isBlockedPath = blockedWhenExpired.some(path => pathname.startsWith(path))

    if (isBlockedPath && profile?.organization_id && adminRoles.includes(role)) {
      const { data: org } = await supabase
        .from('organizations')
        .select('subscription_status, trial_ends_at')
        .eq('id', profile.organization_id)
        .single()

      // Check for canceled subscription - block features
      if (org?.subscription_status === 'canceled') {
        const url = request.nextUrl.clone()
        url.pathname = '/billing'
        url.searchParams.set('canceled', 'true')
        return NextResponse.redirect(url)
      }

      if (org?.subscription_status === 'trialing' && org.trial_ends_at) {
        const trialEnd = new Date(org.trial_ends_at)
        const now = new Date()
        
        if (trialEnd < now) {
          // Trial has expired - redirect to billing
          const url = request.nextUrl.clone()
          url.pathname = '/billing'
          url.searchParams.set('expired', 'true')
          return NextResponse.redirect(url)
        }
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
