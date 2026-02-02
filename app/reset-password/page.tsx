'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase/client'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-6">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-white tracking-widest mb-2" style={{ fontFamily: 'Sora, sans-serif' }}>CHECK YOUR EMAIL</h1>
          <div className="w-12 h-1 bg-yellow-400 mx-auto mb-4"></div>
          <p className="text-zinc-400 mb-6">
            We sent a password reset link to <span className="text-white">{email}</span>
          </p>
          <Link
            href="/login"
            className="text-zinc-500 hover:text-yellow-400 transition-colors"
          >
            ← Back to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-widest" style={{ fontFamily: 'Sora, sans-serif' }}>RESET PASSWORD</h1>
          <div className="w-12 h-1 bg-yellow-400 mx-auto mt-3 mb-4"></div>
          <p className="text-zinc-500">Enter your email to receive a reset link</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-zinc-500 text-sm mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-bold uppercase tracking-wider py-3 rounded-xl transition-colors"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="text-center mt-6">
          <Link href="/login" className="text-zinc-500 hover:text-yellow-400 transition-colors">
            ← Back to Login
          </Link>
        </p>
      </div>
    </div>
  )
}
