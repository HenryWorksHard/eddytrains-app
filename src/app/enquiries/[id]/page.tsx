'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, Mail, Phone, Loader2, Check } from 'lucide-react'
import { apiFetch } from '@/app/lib/api'
import {
  INTAKE_STATUSES,
  answerList,
  fullName,
  type IntakeStatus,
  type IntakeSubmission,
} from '@/app/lib/intake'

// One enquiry, in full.
//
// The questions are rendered from the labels that came with the submission
// rather than from a copy of the form held here, so changing the questions on
// the landing site needs no deploy of this app.

export default function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [s, setS] = useState<IntakeSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch(`/api/enquiries/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return }
        setS(d.submission)
        setNotes(d.submission?.notes ?? '')
      })
      .catch(() => setError('Could not load the enquiry'))
      .finally(() => setLoading(false))
  }, [id])

  async function save(patch: { status?: IntakeStatus; notes?: string }) {
    setSaving(true)
    try {
      const r = await apiFetch(`/api/enquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const d = await r.json()
      if (d.error) { setError(d.error); return }
      setS(d.submission)
      setSavedAt(Date.now())
    } catch {
      setError('Could not save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading
      </div>
    )
  }

  if (error || !s) {
    return (
      <div className="max-w-2xl">
        <Link href="/enquiries" className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Enquiries
        </Link>
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          {error ?? 'Not found'}
        </div>
      </div>
    )
  }

  const answers = answerList(s.answers)

  return (
    <div className="max-w-3xl">
      <Link href="/enquiries" className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Enquiries
      </Link>

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-white">{fullName(s)}</h1>
        <span className="text-sm text-zinc-500">
          {new Date(s.created_at).toLocaleString('en-AU', {
            day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
          })}
        </span>
      </div>

      {s.areas.length > 0 && <p className="mb-4 text-zinc-400">{s.areas.join(', ')}</p>}

      <div className="mb-6 flex flex-wrap gap-3">
        {s.email && (
          <a
            href={`mailto:${s.email}`}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-white hover:border-zinc-700"
          >
            <Mail className="h-4 w-4 text-yellow-400" /> {s.email}
          </a>
        )}
        {s.phone && (
          <a
            href={`tel:${s.phone}`}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-white hover:border-zinc-700"
          >
            <Phone className="h-4 w-4 text-yellow-400" /> {s.phone}
          </a>
        )}
      </div>

      {s.red_flags.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/5 p-4">
          <p className="flex items-center gap-2 font-semibold text-red-300">
            <AlertTriangle className="h-4 w-4" /> Screening flag
          </p>
          <p className="mt-2 text-sm text-red-200/90">Answered yes to:</p>
          <ul className="mt-1 list-inside list-disc text-sm text-red-200/90">
            {s.red_flags.map((f) => <li key={f}>{f}</li>)}
          </ul>
          <p className="mt-3 text-sm text-zinc-400">
            Read this before booking. These are the ones that point at something a training
            program cannot fix.
          </p>
        </div>
      )}

      {/* Status */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Status</p>
          {savedAt && !saving && (
            <span className="inline-flex items-center gap-1 text-xs text-green-400">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          {saving && <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />}
        </div>
        <div className="flex flex-wrap gap-2">
          {INTAKE_STATUSES.map((st) => (
            <button
              key={st.value}
              title={st.hint}
              disabled={saving}
              onClick={() => save({ status: st.value })}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                s.status === st.value
                  ? 'bg-yellow-400 text-black'
                  : 'border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <label htmlFor="notes" className="mb-2 block text-sm font-semibold text-white">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          rows={4}
          placeholder="What you agreed on the call, what you sent them, anything to remember."
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (s.notes ?? '') && save({ notes })}
          className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-yellow-400 focus:outline-none"
        />
        <p className="mt-2 text-xs text-zinc-500">Saves when you click away.</p>
      </div>

      {/* The form itself */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        <p className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-white">
          What they said
        </p>
        <dl className="divide-y divide-zinc-800">
          {answers.map((a) => (
            <div key={a.name} className="px-4 py-3">
              <dt className="text-xs text-zinc-500">{a.label}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">
                {a.value || <span className="text-zinc-600">Blank</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
