'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Inbox, Phone, Mail, Loader2 } from 'lucide-react'
import { apiFetch } from '@/app/lib/api'
import { INTAKE_STATUSES, fullName, type IntakeStatus } from '@/app/lib/intake'

// Injury enquiries from the landing page.
//
// These are not clients yet: somebody filled in the injury form on
// cmpdcollective.com and is waiting to hear back. The job of this page is to
// make "who has not been answered" obvious at a glance, which is why New is
// the default filter and the screening flag is on the row rather than inside.

type Row = {
  id: string
  created_at: string
  status: IntakeStatus
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  areas: string[]
  red_flags: string[]
}

function since(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${Math.max(mins, 0)}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default function EnquiriesPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<IntakeStatus | 'all'>('new')
  const [loading, setLoading] = useState(true)
  const [notSetUp, setNotSetUp] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setLoading(true)
    apiFetch(`/api/enquiries?status=${filter}`)
      .then((r) => r.json())
      .then((d) => {
        if (!live) return
        if (d.error) { setError(d.error); return }
        setRows(d.submissions ?? [])
        setCounts(d.counts ?? {})
        setNotSetUp(!!d.notSetUp)
        setError(null)
      })
      .catch(() => live && setError('Could not load enquiries'))
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [filter])

  const newCount = counts.new ?? 0

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Enquiries</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Injury forms from the website. These people are waiting on a call.
        </p>
      </div>

      {notSetUp && (
        <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-200">
          The enquiries table has not been created yet, so nothing can arrive here. Run the
          migration in <code className="text-yellow-400">supabase/migrations/pending/</code> and
          set the intake environment variables.
        </div>
      )}

      {/* Filters. New first, because that is the only one with work in it. */}
      <div className="mb-5 flex flex-wrap gap-2">
        {([{ value: 'all' as const, label: 'All' }, ...INTAKE_STATUSES]).map((s) => {
          const n = s.value === 'all'
            ? Object.values(counts).reduce((a, b) => a + b, 0)
            : counts[s.value] ?? 0
          const on = filter === s.value
          return (
            <button
              key={s.value}
              onClick={() => setFilter(s.value as IntakeStatus | 'all')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                on
                  ? 'bg-yellow-400 text-black'
                  : 'border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
              }`}
            >
              {s.label}
              {n > 0 && (
                <span className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${on ? 'bg-black/15' : 'bg-zinc-800 text-zinc-400'}`}>
                  {n}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading
        </div>
      ) : rows.length === 0 && !error ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-6 py-16 text-center">
          <Inbox className="mx-auto h-8 w-8 text-zinc-700" />
          <p className="mt-3 text-sm text-zinc-400">
            {filter === 'new'
              ? newCount === 0 && Object.keys(counts).length > 0
                ? 'Nothing new. Everything has been picked up.'
                : 'No enquiries yet.'
              : 'Nothing in here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/enquiries/${r.id}`}
              className="block rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{fullName(r)}</span>
                    {r.status === 'new' && (
                      <span className="rounded bg-yellow-400 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black">
                        New
                      </span>
                    )}
                    {r.red_flags.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-red-300">
                        <AlertTriangle className="h-3 w-3" />
                        Screening flag
                      </span>
                    )}
                  </div>
                  {r.areas.length > 0 && (
                    <p className="mt-1 text-sm text-zinc-400">{r.areas.join(', ')}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                    {r.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />{r.email}
                      </span>
                    )}
                    {r.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />{r.phone}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">{since(r.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
