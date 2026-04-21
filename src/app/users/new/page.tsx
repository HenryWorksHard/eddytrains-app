'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/app/lib/supabase/client'
import { ArrowLeft, Mail, User, Check, AlertCircle, Dumbbell, Heart, Zap, Loader2, Apple, CreditCard, Copy } from 'lucide-react'

export default function NewUserPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [permissions, setPermissions] = useState({
    strength: false,
    cardio: false,
    hyrox: false,
    hybrid: false,
    nutrition: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [success, setSuccess] = useState(false)
  const [inviteSent, setInviteSent] = useState(true)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [, setHasOrg] = useState(false)

  useEffect(() => {
    // Note: the server resolves the target org itself via getEffectiveOrgId() on POST.
    // We still fetch the effective orgId here just so the UI can show impersonation context
    // if ever needed and to double-check the user has an org before allowing submit.
    async function getOrganization() {
      const res = await fetch('/api/me')
      if (!res.ok) return
      const me = await res.json()
      if (me?.organizationId) setHasOrg(true)
    }
    getOrganization()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setUpgradeRequired(false)
    setLoading(true)

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          full_name: fullName,
          permissions,
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        if (data.upgradeRequired) {
          setUpgradeRequired(true)
          setError(data.details || data.error)
        } else {
          setError(data.error || 'Failed to create user')
        }
        return
      }
      
      setSuccess(true)
      setInviteSent(data.inviteSent === true)
      setInviteLink(data.inviteLink || null)
      setInviteError(data.inviteError || null)

      // Auto-redirect only if the invite email sent cleanly
      if (data.inviteSent) {
        setTimeout(() => {
          router.push('/users')
          router.refresh()
        }, 2000)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const permissionOptions = [
    { key: 'strength', name: 'Strength Training', icon: Dumbbell, desc: 'Access to strength workouts and programs' },
    { key: 'cardio', name: 'Cardio', icon: Heart, desc: 'Access to cardio and conditioning programs' },
    { key: 'hyrox', name: 'HYROX', icon: Zap, desc: 'Access to HYROX-specific training' },
    { key: 'hybrid', name: 'Hybrid', icon: Zap, desc: 'Access to hybrid strength + cardio programs' },
    { key: 'nutrition', name: 'Nutrition', icon: Apple, desc: 'Access to nutrition plans and guides' },
  ]

  if (success) {
    const copyLink = async () => {
      if (!inviteLink) return
      try {
        await navigator.clipboard.writeText(inviteLink)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // Fallback: select the text so user can copy manually
      }
    }

    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Client Created</h2>

          {inviteSent ? (
            <>
              <p className="text-zinc-400 mb-4">
                Invite email sent to <span className="text-white font-medium">{email}</span>.
                They&apos;ll click the link in the email to set their password.
              </p>
              <p className="text-sm text-zinc-500">Redirecting to clients list...</p>
            </>
          ) : (
            <>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4 text-left">
                <p className="text-yellow-400 text-sm font-medium mb-2">
                  Invite email didn&apos;t send
                </p>
                <p className="text-zinc-400 text-sm mb-3">
                  {inviteError || 'The email service returned an error.'} Copy the invite link
                  below and send it to your client directly. The link is valid for 7 days.
                </p>
                {inviteLink && (
                  <div className="bg-zinc-900 rounded-lg p-3 space-y-3">
                    <div className="text-xs text-zinc-500 break-all font-mono">
                      {inviteLink}
                    </div>
                    <button
                      onClick={copyLink}
                      className="flex items-center justify-center gap-2 w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy invite link
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
              <Link
                href="/users"
                className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-xl transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Clients
              </Link>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/users"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </Link>
        <h1 className="text-3xl font-bold text-white">Add New Client</h1>
        <p className="text-zinc-400 mt-1">Create a new client account and send them an invite</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className={`rounded-xl p-4 ${upgradeRequired ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
            <div className="flex items-center gap-3">
              <AlertCircle className={`w-5 h-5 flex-shrink-0 ${upgradeRequired ? 'text-yellow-400' : 'text-red-400'}`} />
              <p className={`text-sm ${upgradeRequired ? 'text-yellow-400' : 'text-red-400'}`}>{error}</p>
            </div>
            {upgradeRequired && (
              <Link
                href="/billing"
                className="mt-3 flex items-center justify-center gap-2 w-full py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                Upgrade Plan
              </Link>
            )}
          </div>
        )}

        {/* Basic Info */}
        <div className="card p-6 space-y-6">
          <h2 className="text-xl font-semibold text-white">Basic Information</h2>
          
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address *
              </div>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              placeholder="client@example.com"
              required
            />
            <p className="mt-2 text-sm text-zinc-500">
              An invite email with a temporary password will be sent to this address
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Full Name
              </div>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              placeholder="John Smith"
            />
          </div>
        </div>

        {/* Permissions */}
        <div className="card p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Permissions</h2>
            <p className="text-zinc-400 text-sm mt-1">Select what content this user can access</p>
          </div>
          
          <div className="space-y-3">
            {permissionOptions.map((perm) => (
              <label
                key={perm.key}
                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                  permissions[perm.key as keyof typeof permissions]
                    ? 'bg-yellow-400/10 border-yellow-400/30'
                    : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={permissions[perm.key as keyof typeof permissions]}
                  onChange={(e) => setPermissions(prev => ({ ...prev, [perm.key]: e.target.checked }))}
                  className="sr-only"
                />
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  permissions[perm.key as keyof typeof permissions]
                    ? 'bg-yellow-400 text-black'
                    : 'bg-zinc-700 text-zinc-400'
                }`}>
                  <perm.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${
                    permissions[perm.key as keyof typeof permissions] ? 'text-white' : 'text-zinc-300'
                  }`}>
                    {perm.name}
                  </p>
                  <p className="text-sm text-zinc-500">{perm.desc}</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  permissions[perm.key as keyof typeof permissions]
                    ? 'bg-yellow-400 border-yellow-400'
                    : 'border-zinc-600'
                }`}>
                  {permissions[perm.key as keyof typeof permissions] && (
                    <Check className="w-4 h-4 text-white" />
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Link
            href="/users"
            className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl text-center transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !email}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black font-medium rounded-xl transition-colors"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Mail className="w-5 h-5" />
                Create & Send Invite
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
