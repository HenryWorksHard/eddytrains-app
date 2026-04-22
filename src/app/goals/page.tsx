'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowLeft, Plus, Target, Trash2, Check, Loader2, X } from 'lucide-react'
import BottomNav from '../components/BottomNav'
import AppLoading from '@/components/AppLoading'

type Goal = {
  id: string
  title: string
  kind: 'lift' | 'workouts' | 'body_weight' | 'custom'
  metric: string | null
  target_value: number | null
  current_value: number
  target_date: string | null
  achieved: boolean
  achieved_at: string | null
  created_at: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const KIND_LABELS: Record<Goal['kind'], { label: string; desc: string; placeholder: string }> = {
  lift: {
    label: 'Lift target',
    desc: 'Tracks your max tested 1RM for this exercise.',
    placeholder: 'e.g. Back Squat',
  },
  workouts: {
    label: 'Workout count',
    desc: 'Counts completed workouts from the day this goal was set.',
    placeholder: '',
  },
  body_weight: {
    label: 'Body weight',
    desc: 'Tracks your body weight over time. Update manually for now.',
    placeholder: '',
  },
  custom: {
    label: 'Custom',
    desc: "Anything you want to track. You'll update progress manually.",
    placeholder: '',
  },
}

export default function GoalsPage() {
  const { data, mutate, isLoading } = useSWR<{ goals: Goal[] }>('/api/goals', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
  const [adding, setAdding] = useState(false)

  if (isLoading && !data) return <AppLoading />

  const active = (data?.goals || []).filter((g) => !g.achieved)
  const achieved = (data?.goals || []).filter((g) => g.achieved)

  return (
    <div className="min-h-screen bg-black pb-nav">
      <header className="sticky top-0 bg-black/95 backdrop-blur-lg border-b border-zinc-800 z-20">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link href="/dashboard" className="p-1.5 -ml-1.5 text-zinc-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold text-white flex-1">Goals</h1>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add goal
          </button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {active.length === 0 && achieved.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-yellow-400/10 flex items-center justify-center mx-auto mb-3">
              <Target className="w-7 h-7 text-yellow-400" />
            </div>
            <h2 className="text-white font-semibold mb-1">Set your first goal</h2>
            <p className="text-zinc-400 text-sm mb-4">
              A concrete target makes every session matter.
            </p>
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold rounded-xl"
            >
              <Plus className="w-4 h-4" />
              Add a goal
            </button>
          </div>
        )}

        {active.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              Active ({active.length})
            </h2>
            <div className="space-y-3">
              {active.map((g) => (
                <GoalCard key={g.id} goal={g} onChange={mutate} />
              ))}
            </div>
          </section>
        )}

        {achieved.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              Achieved ({achieved.length})
            </h2>
            <div className="space-y-3">
              {achieved.map((g) => (
                <GoalCard key={g.id} goal={g} onChange={mutate} />
              ))}
            </div>
          </section>
        )}
      </main>

      <BottomNav />

      {adding && <AddGoalModal onClose={() => setAdding(false)} onAdded={() => mutate()} />}
    </div>
  )
}

function GoalCard({ goal, onChange }: { goal: Goal; onChange: () => void }) {
  const [updating, setUpdating] = useState(false)
  const [customValue, setCustomValue] = useState<string>('')
  const pct =
    goal.target_value && goal.target_value > 0
      ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
      : null

  const handleDelete = async () => {
    if (!confirm('Delete this goal?')) return
    setUpdating(true)
    await fetch(`/api/goals/${goal.id}`, { method: 'DELETE' })
    setUpdating(false)
    onChange()
  }

  const handleCustomUpdate = async () => {
    const n = Number(customValue)
    if (Number.isNaN(n)) return
    setUpdating(true)
    await fetch(`/api/goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_value: n }),
    })
    setUpdating(false)
    setCustomValue('')
    onChange()
  }

  return (
    <div
      className={`bg-zinc-900 border rounded-2xl p-4 ${
        goal.achieved ? 'border-green-500/40' : 'border-zinc-800'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">{goal.title}</p>
          <p className="text-zinc-500 text-xs mt-0.5">
            {KIND_LABELS[goal.kind].label}
            {goal.metric ? ` · ${goal.metric}` : ''}
            {goal.target_date ? ` · by ${new Date(goal.target_date).toLocaleDateString()}` : ''}
          </p>
        </div>
        {goal.achieved ? (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 text-[10px] font-semibold rounded-full flex-shrink-0">
            <Check className="w-3 h-3" />
            Achieved
          </span>
        ) : (
          <button
            onClick={handleDelete}
            disabled={updating}
            className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors flex-shrink-0"
            aria-label="Delete goal"
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        )}
      </div>

      {goal.target_value !== null && (
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-white font-semibold tabular-nums text-sm">
              {goal.current_value}
              <span className="text-zinc-500 font-normal"> / {goal.target_value}</span>
            </span>
            {pct !== null && <span className="text-xs text-zinc-500 tabular-nums">{pct}%</span>}
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                goal.achieved ? 'bg-green-500' : 'bg-yellow-400'
              }`}
              style={{ width: `${pct ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Manual-update input for custom / body_weight goals */}
      {!goal.achieved && (goal.kind === 'custom' || goal.kind === 'body_weight') && (
        <div className="flex items-center gap-2 mt-3">
          <input
            type="number"
            inputMode="decimal"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder={`Current (${goal.current_value})`}
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-yellow-400"
          />
          <button
            onClick={handleCustomUpdate}
            disabled={updating || customValue === ''}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg disabled:opacity-50"
          >
            Update
          </button>
        </div>
      )}
    </div>
  )
}

function AddGoalModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [kind, setKind] = useState<Goal['kind']>('lift')
  const [title, setTitle] = useState('')
  const [metric, setMetric] = useState('')
  const [targetValue, setTargetValue] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        kind,
        metric: kind === 'lift' ? metric : undefined,
        target_value: targetValue || undefined,
        target_date: targetDate || undefined,
      }),
    })
    setSaving(false)
    if (res.ok) {
      onAdded()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center px-4 pb-6">
      <form
        onSubmit={handleSave}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">New goal</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Kind</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(KIND_LABELS) as Goal['kind'][]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                  kind === k
                    ? 'bg-yellow-400 text-black border-yellow-400'
                    : 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                {KIND_LABELS[k].label}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-1.5">{KIND_LABELS[kind].desc}</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Squat 200kg by December"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-yellow-400"
          />
        </div>

        {kind === 'lift' && (
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Exercise</label>
            <input
              type="text"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              placeholder={KIND_LABELS.lift.placeholder}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Matches your tested 1RM for this exercise. Update 1RMs at
              <Link href="/1rm-tracking" className="text-yellow-400 underline ml-1">
                /1rm-tracking
              </Link>
              .
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Target {kind === 'lift' ? '(kg)' : kind === 'workouts' ? '(count)' : ''}
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="200"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">By (optional)</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-yellow-400"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title}
            className="flex-1 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add goal'}
          </button>
        </div>
      </form>
    </div>
  )
}
