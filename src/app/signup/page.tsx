'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'

type SignupResponse = {
  success: boolean
  email: string
  organization: { id: string; name: string; slug: string }
  emailSent: boolean
  emailError: string | null
  inviteLink: string | null
}

// Trainer self-serve signup. Public route — middleware bypasses auth check.
// The actual provisioning lives in /api/signup; this page just owns the
// form UX. After successful submission we swap to a "check your email"
// confirmation state with the trainer's email so they know where to look.

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [orgName, setOrgName] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<SignupResponse | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          orgName: orgName.trim(),
          fullName: fullName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setError(data?.error || 'Something went wrong. Please try again.')
        return
      }
      setSuccess(data as SignupResponse)
    } catch (err) {
      console.error('[signup] submit failed:', err)
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Success state — trainer has been provisioned, email is on the way.
  if (success) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <Image src="/logo.svg" alt="CMPD Fitness" width={56} height={56} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              We sent a link to <span className="text-white font-medium">{success.email}</span>.
              Click it to set your password and start your 14-day free trial.
            </p>
          </div>

          {/* If the email send failed, surface the invite link so the
              trainer isn't stuck. Should be rare — Resend is reliable —
              but worth defending against. */}
          {!success.emailSent && success.inviteLink && (
            <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-4 mb-6">
              <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wide mb-2">
                Email delivery delayed
              </p>
              <p className="text-zinc-300 text-sm mb-3">
                Your account is set up, but the welcome email didn&apos;t send.
                Use this link to set your password directly:
              </p>
              <a
                href={success.inviteLink}
                className="block w-full text-center bg-yellow-400 text-black font-semibold py-3 rounded-xl"
              >
                Set your password
              </a>
            </div>
          )}

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-2 flex-shrink-0" />
              <p className="text-zinc-400">
                <span className="text-white">14 days free.</span> No card required to start.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-2 flex-shrink-0" />
              <p className="text-zinc-400">
                <span className="text-white">Up to 10 clients</span> on Starter. Upgrade any time.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-2 flex-shrink-0" />
              <p className="text-zinc-400">
                <span className="text-white">Email not arriving?</span> Check spam, then{' '}
                <a href="mailto:contact@cmpdcollective.com" className="text-yellow-400 hover:underline">
                  contact us
                </a>.
              </p>
            </div>
          </div>

          <p className="text-center text-zinc-500 text-xs mt-8">
            Already have an account?{' '}
            <Link href="/login" className="text-yellow-400 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  // Form state
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <Image src="/logo.svg" alt="CMPD Fitness" width={56} height={56} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Start your free trial</h1>
          <p className="text-zinc-400 text-sm">
            14 days. No credit card. Cancel anytime.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-zinc-300 text-sm font-medium mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourbusiness.com"
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 transition-colors"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="orgName" className="block text-zinc-300 text-sm font-medium mb-2">
              Business or studio name
            </label>
            <input
              id="orgName"
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Your Coaching Co."
              maxLength={80}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 transition-colors"
              disabled={submitting}
            />
            <p className="text-zinc-600 text-xs mt-1.5">
              This appears in your clients&apos; app and on invite emails.
            </p>
          </div>

          <div>
            <label htmlFor="fullName" className="block text-zinc-300 text-sm font-medium mb-2">
              Your name <span className="text-zinc-600 font-normal">(optional)</span>
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Coach"
              maxLength={80}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-400 transition-colors"
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !orgName}
            className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Setting up your studio...
              </>
            ) : (
              'Start free trial'
            )}
          </button>

          <p className="text-center text-zinc-600 text-xs">
            By signing up you agree to our{' '}
            <Link href="/privacy" className="text-zinc-400 hover:underline">
              privacy policy
            </Link>.
          </p>
        </form>

        <p className="text-center text-zinc-500 text-sm mt-8">
          Already have an account?{' '}
          <Link href="/login" className="text-yellow-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
