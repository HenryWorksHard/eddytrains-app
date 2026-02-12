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
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    // Check if this is a required password change (first login)
    if (searchParams.get('required') === 'true') {
      setIsRequired(true)
    }
  }, [searchParams])

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

      setMessage('Password updated successfully!')
      
      // Redirect to dashboard after a moment
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
            disabled={loading}
            className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-xl text-black font-bold uppercase tracking-wider transition-colors"
          >
            {loading ? 'Updating...' : 'Set Password'}
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

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    }>
      <UpdatePasswordForm />
    </Suspense>
  )
}
