'use client'

import { useEffect, useState } from 'react'
import { Mail, ExternalLink, RefreshCw } from 'lucide-react'
import AppLoading from '@/components/AppLoading'

type TemplateSetting = {
  name: string
  enabled: boolean
  description: string | null
  updated_at: string
}

type ResendEmail = {
  id: string
  to: string[] | string
  from: string
  subject: string
  created_at: string
  last_event?: string | null
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return iso
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return new Date(iso).toLocaleDateString()
}

function statusPill(status: string | null | undefined) {
  const s = (status || 'unknown').toLowerCase()
  let cls = 'bg-zinc-700/40 text-zinc-300'
  if (s.includes('deliver')) cls = 'bg-green-500/10 text-green-400'
  else if (s.includes('open')) cls = 'bg-blue-500/10 text-blue-400'
  else if (s.includes('click')) cls = 'bg-purple-500/10 text-purple-400'
  else if (s.includes('bounce') || s.includes('fail')) cls = 'bg-red-500/10 text-red-400'
  else if (s.includes('complain')) cls = 'bg-orange-500/10 text-orange-400'
  else if (s.includes('sent') || s.includes('queue')) cls = 'bg-yellow-400/10 text-yellow-400'
  return <span className={`px-2 py-1 rounded text-xs ${cls}`}>{s}</span>
}

export default function EmailsPage() {
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<TemplateSetting[]>([])
  const [emails, setEmails] = useState<ResendEmail[]>([])
  const [emailsError, setEmailsError] = useState<string | null>(null)
  const [refreshingEmails, setRefreshingEmails] = useState(false)
  const [savingName, setSavingName] = useState<string | null>(null)

  async function loadTemplates() {
    const res = await fetch('/api/admin/email-settings', { cache: 'no-store' })
    const json = await res.json()
    if (res.ok) setTemplates(json.data || [])
  }

  async function loadEmails() {
    setRefreshingEmails(true)
    try {
      const res = await fetch('/api/admin/emails?limit=50', { cache: 'no-store' })
      const json = await res.json()
      setEmails(json.data || [])
      setEmailsError(json.error || null)
    } catch (e) {
      setEmailsError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setRefreshingEmails(false)
    }
  }

  useEffect(() => {
    (async () => {
      await Promise.all([loadTemplates(), loadEmails()])
      setLoading(false)
    })()
  }, [])

  async function toggleTemplate(name: string, nextEnabled: boolean) {
    const prev = templates
    setSavingName(name)
    setTemplates(ts => ts.map(t => (t.name === name ? { ...t, enabled: nextEnabled } : t)))
    try {
      const res = await fetch(`/api/admin/email-settings/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled }),
      })
      if (!res.ok) throw new Error('save failed')
      const json = await res.json()
      setTemplates(ts => ts.map(t => (t.name === name ? json.data : t)))
    } catch {
      setTemplates(prev)
      alert('Failed to update template')
    } finally {
      setSavingName(null)
    }
  }

  if (loading) return <AppLoading />

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <Mail className="w-6 h-6 text-yellow-400" />
          Email notifications
        </h1>
        <p className="text-zinc-400">Toggle transactional templates and review recent sends.</p>
      </div>

      {/* Templates */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">Templates</h2>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 divide-y divide-zinc-800">
          {templates.length === 0 && (
            <div className="p-6 text-zinc-500 text-sm">No templates configured.</div>
          )}
          {templates.map(t => (
            <div key={t.name} className="flex items-start justify-between gap-4 p-5">
              <div className="flex-1">
                <p className="text-white font-medium font-mono text-sm">{t.name}</p>
                {t.description && (
                  <p className="text-zinc-400 text-sm mt-1">{t.description}</p>
                )}
              </div>
              <button
                onClick={() => toggleTemplate(t.name, !t.enabled)}
                disabled={savingName === t.name}
                aria-label={`Toggle ${t.name}`}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                  t.enabled ? 'bg-yellow-400' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    t.enabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent sends */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent sends</h2>
          <button
            onClick={loadEmails}
            disabled={refreshingEmails}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshingEmails ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {emailsError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            Resend API: {emailsError}
          </div>
        )}

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left p-4 text-zinc-400 font-medium text-sm">To</th>
                <th className="text-left p-4 text-zinc-400 font-medium text-sm">Subject</th>
                <th className="text-left p-4 text-zinc-400 font-medium text-sm">Status</th>
                <th className="text-left p-4 text-zinc-400 font-medium text-sm">Sent</th>
                <th className="text-left p-4 text-zinc-400 font-medium text-sm"></th>
              </tr>
            </thead>
            <tbody>
              {emails.map(e => {
                const to = Array.isArray(e.to) ? e.to.join(', ') : e.to
                return (
                  <tr key={e.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                    <td className="p-4 text-zinc-200 text-sm">{to}</td>
                    <td className="p-4 text-white text-sm">{e.subject}</td>
                    <td className="p-4">{statusPill(e.last_event)}</td>
                    <td className="p-4 text-zinc-400 text-sm" title={e.created_at}>
                      {relativeTime(e.created_at)}
                    </td>
                    <td className="p-4">
                      <a
                        href={`https://resend.com/emails/${e.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-yellow-400 hover:text-yellow-300 text-sm"
                      >
                        Resend
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {emails.length === 0 && !emailsError && (
            <div className="p-8 text-center text-zinc-500 text-sm">No recent sends.</div>
          )}
        </div>
      </div>
    </div>
  )
}
