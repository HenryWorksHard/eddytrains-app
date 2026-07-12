'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'

function UpdatePasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isRequired, setIsRequired] = useState(false)
  // Track whether we're restoring a recovery-link session on mount so the
  // submit button stays disabled until the session is ready. Otherwise the
  // user could submit before setSession/exchangeCodeForSession finishes and
  // hit "Auth session missing".
  const [restoringSession, setRestoringSession] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    // Check if this is a required password change (first login)
    if (searchParams.get('required') === 'true') {
      setIsRequired(true)
    }
  }, [searchParams])

  // Restore the recovery session from the URL. Supabase's admin.generateLink
  // ({ type: 'recovery' }) redirects here with either:
  //   ?code=<pkce_code>         → exchangeCodeForSession
  //   #access_token=&refresh_token=&type=recovery → setSession
  // Neither was processed before, so supabase.auth.updateUser fired without
  // an active session and returned "Auth session missing" — Nic's bug.
  //
  // We ALSO check for an already-live session (user opened /update-password
  // from inside the app to voluntarily change their password). In that case
  // there are no tokens in the URL and we just proceed.
  useEffect(() => {
    let cancelled = false

    async function restoreRecoverySession() {
      try {
        // Case 1: user is already logged in (opened /update-password from
        // /profile or was redirected here by middleware with ?required=true).
        // Fast path — no URL parsing needed.
        const { data: existing } = await supabase.auth.getSession()
        if (existing?.session) {
          if (!cancelled) setRestoringSession(false)
          return
        }

        // Case 2: PKCE recovery link → ?code=... in query
        const code = searchParams.get('code')
        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeErr) {
            console.error('[update-password] exchangeCodeForSession failed:', exchangeErr)
            if (!cancelled) setError('This reset link is invalid or has expired. Request a new one.')
          } else {
            // Strip the code from the URL so a refresh doesn't try to re-exchange
            // an already-consumed code.
            const cleanUrl = new URL(window.location.href)
            cleanUrl.searchParams.delete('code')
            cleanUrl.searchParams.delete('type')
            window.history.replaceState({}, '', cleanUrl.toString())
          }
          if (!cancelled) setRestoringSession(false)
          return
        }

        // Case 3: implicit recovery link → #access_token=&refresh_token= in hash
        const rawHash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash
        if (rawHash) {
          const hashParams = new URLSearchParams(rawHash)
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          if (accessToken && refreshToken) {
            const { error: setErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (setErr) {
              console.error('[update-password] setSession failed:', setErr)
              if (!cancelled) setError('This reset link is invalid or has expired. Request a new one.')
            } else {
              // Clear the hash so a refresh doesn't retry with stale tokens.
              window.history.replaceState({}, '', window.location.pathname + window.location.search)
            }
            if (!cancelled) setRestoringSession(false)
            return
          }
          // Hash present but no tokens — expired or error link
          const errDesc = hashParams.get('error_description') || hashParams.get('error')
          if (errDesc) {
            if (!cancelled) setError(decodeURIComponent(errDesc.replace(/\+/g, ' ')))
          }
        }

        // Case 4: no session, no tokens, no required flag — user landed here
        // without a valid path. Middleware normally blocks this but be defensive.
        if (!cancelled) {
          setRestoringSession(false)
          if (!searchParams.get('required')) {
            setError('No active session. Please request a new password reset link.')
          }
        }
      } catch (e) {
        console.error('[update-password] session restore failed:', e)
        if (!cancelled) {
          setRestoringSession(false)
          setError('Could not verify your reset link. Please request a new one.')
        }
      }
    }

    restoreRecoverySession()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      setLoading(false)
      return
    }

    try {
      // Double-check the session is live before firing updateUser. If the
      // recovery-link restore failed silently we'd otherwise get the
      // "Auth session missing" error at this point.
      const { data: sessionCheck } = await supabase.auth.getSession()
      if (!sessionCheck?.session) {
        throw new Error('Your reset session has expired. Please request a new password reset link.')
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) throw updateError

      // Mark password as changed in profile
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('profiles')
          .update({ password_changed: true })
          .eq('id', user.id)
      }

      // Invalidate the middleware's profile cache so the new flag is
      // honored on the very next navigation.
      await fetch('/api/auth/cache-refresh', { method: 'POST' }).catch(() => {})

      // Fire-and-forget confirmation email. Server resolves the address
      // from the session — we never pass it from the browser.
      fetch('/api/auth/notify-password-changed', { method: 'POST' }).catch(() => {})

      setMessage('Password updated successfully!')

      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update password'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header - Industrial Minimal */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-widest mb-2" style={{ fontFamily: 'Sora, sans-serif' }}>
            {isRequired ? 'SET PASSWORD' : 'UPDATE PASSWORD'}
          </h1>
          <div className="w-12 h-1 bg-yellow-400 mx-auto mb-4"></div>
          <p className="text-zinc-500">
            {isRequired 
              ? 'Please set a new password to continue'
              : 'Enter your new password'
            }
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-zinc-500 text-sm mb-2">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-zinc-500 text-sm mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || restoringSession}
            className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-xl text-black font-bold uppercase tracking-wider transition-colors"
          >
            {restoringSession ? 'Verifying link...' : loading ? 'Updating...' : 'Set Password'}
          </button>
        </form>

        {!isRequired && (
          <p className="text-center text-zinc-600 text-sm mt-6">
            <button 
              onClick={() => router.push('/profile')}
              className="text-zinc-500 hover:text-yellow-400 transition-colors"
            >
              ← Back to Profile
            </button>
          </p>
        )}

        {isRequired && (
          <p className="text-center text-zinc-600 text-sm mt-6">
            Password must be at least 8 characters
          </p>
        )}
      </div>
    </div>
  )
}

import AppLoading from '@/components/AppLoading'

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      <UpdatePasswordForm />
    </Suspense>
  )
}
