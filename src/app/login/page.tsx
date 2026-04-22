'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'
import { LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react'
import BrandMark from '@/components/BrandMark'
import AppLoading from '@/components/AppLoading'
import { useIsNativeApp } from '@/hooks/useIsNativeApp'

export default function LoginPage() {
  return (
    <Suspense fallback={<AppLoading message="Loading..." />}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const isNativeApp = useIsNativeApp()

  const urlError = searchParams?.get('error')

  const handleAppleSignIn = async () => {
    setError(null)
    setAppleLoading(true)
    try {
      if (isNativeApp) {
        // Native: open OAuth flow in SFSafariViewController via @capacitor/browser.
        // Supabase will redirect back to our universal-link callback URL after auth.
        const { Browser } = await import('@capacitor/browser')
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: {
            redirectTo: 'https://app.cmpdcollective.com/auth/callback',
            skipBrowserRedirect: true,
          },
        })
        if (error) {
          setError(error.message)
          return
        }
        if (data?.url) {
          await Browser.open({ url: data.url })
        }
      } else {
        // Web: standard redirect flow
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error) {
          setError(error.message)
        }
      }
    } catch (e) {
      console.error('Apple sign in error:', e)
      setError('Apple sign in is not available right now. Try email instead.')
    } finally {
      setAppleLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        return
      }

      if (data.user) {
        // Get user profile for role-based redirect
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()

        const role = profile?.role || 'client'

        // Show redirecting state
        setRedirecting(true)

        // Redirect based on role - all roles allowed
        if (role === 'super_admin') {
          router.push('/platform')
        } else {
          // All other roles (client, trainer, admin, company_admin) go to dashboard
          // Dashboard component handles showing different views based on role
          router.push('/dashboard')
        }
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Show loading screen while redirecting
  if (redirecting) {
    return <AppLoading message="Signing you in..." />
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-4 overflow-hidden overscroll-none">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <BrandMark size="lg" className="mx-auto mb-4" priority />
          <h1 className="text-2xl font-bold text-white">CMPD Fitness</h1>
          <p className="text-zinc-400 mt-2">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          {(error || urlError) && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">
                {error || (urlError === 'oauth_failed' ? 'Sign in failed. Please try again.' : 'Sign in failed.')}
              </p>
            </div>
          )}

          {/* Sign in with Apple — hidden for v1.0. Current users are trainer-invited
              (email+password). Apple OAuth creates a NEW user by email, which collides
              with existing invited accounts. Re-enable once self-serve signup exists
              or identity-linking is handled properly. Handler + wiring kept so it's a
              one-line flip to bring back.
              See docs/push-notifications-v1.1.md era for context. */}
          {false && (
            <>
              <button
                type="button"
                onClick={handleAppleSignIn}
                disabled={appleLoading || loading}
                className="w-full flex items-center justify-center gap-2 bg-black hover:bg-zinc-950 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl border border-zinc-700 transition-colors"
                aria-label="Sign in with Apple"
              >
                {appleLoading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 384 512"
                      aria-hidden="true"
                      className="w-5 h-5 fill-white"
                    >
                      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zM256 84.4c28.2-33.5 25.6-64 24.8-75-24.9 1.4-53.7 17-70.1 36.1-18.1 20.5-28.7 45.9-26.4 74.4 26.9 2.1 51.5-11.7 71.7-35.5z" />
                    </svg>
                    Sign in with Apple
                  </>
                )}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-zinc-900 px-2 text-zinc-500">or</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleLogin} className="space-y-6">

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                placeholder="admin@cmpdcollective.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent pr-12"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black font-semibold py-3 px-4 rounded-xl transition-colors"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          {!isNativeApp && (
            <div className="mt-6 pt-6 border-t border-zinc-800 text-center">
              <p className="text-zinc-400 text-sm">
                Personal trainer?{' '}
                <a href="/signup" className="text-yellow-400 hover:text-yellow-300">
                  Start your free trial
                </a>
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-zinc-500">
          <Link href="/privacy" className="hover:text-zinc-300">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  )
}
