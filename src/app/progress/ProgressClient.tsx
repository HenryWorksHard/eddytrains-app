'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Flame,
  Weight,
  Camera,
  Dumbbell,
  ChevronRight,
  TrendingUp,
  ChevronDown,
  Trophy,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react'

interface OneRM {
  exercise_name: string
  weight_kg: number
  updated_at: string
}

interface ProgressImage {
  id: string
  image_url: string
  created_at: string
}

interface ProgressPoint {
  date: string
  weight: number
  reps: number
}

interface Estimated1RM {
  exercise_name: string
  weight_kg: number
  reps: number
  estimated_1rm: number
  date: string
}

interface ProgressClientProps {
  oneRMs: OneRM[]
  estimated1RMs: Estimated1RM[]
  progressImages: ProgressImage[]
  weeklyTonnage: number
  tonnageTrendPct: number | null
  monthCompletions: number
  monthScheduled: number
  streak: number
  longestStreak: number
}

type Period = 'week' | 'month' | '3months' | 'year'
type ChartMode = 'volume' | 'exercise'

type VolumePoint = { label: string; value: number }
type ExercisePoint = { date: string; weight: number; reps: number }

export default function ProgressClient({
  oneRMs,
  estimated1RMs,
  progressImages,
  weeklyTonnage,
  tonnageTrendPct,
  monthCompletions,
  monthScheduled,
  streak,
  longestStreak,
}: ProgressClientProps) {
  // Shared period + mode for the unified chart section.
  const [period, setPeriod] = useState<Period>('month')
  const [mode, setMode] = useState<ChartMode>('volume')

  // Exercise mode state
  const [allExercises, setAllExercises] = useState<string[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [exerciseDropdownOpen, setExerciseDropdownOpen] = useState(false)

  // Chart data
  const [volumePoints, setVolumePoints] = useState<VolumePoint[]>([])
  const [exercisePoints, setExercisePoints] = useState<ExercisePoint[]>([])
  const [chartLoading, setChartLoading] = useState(false)

  // Merge tested + estimated PRs into one sorted list.
  const mergedPRs = useMemo(() => {
    const map = new Map<
      string,
      { name: string; tested?: number; estimated: number; reps?: number; date?: string }
    >()
    for (const rm of oneRMs) {
      const key = rm.exercise_name.toLowerCase()
      map.set(key, { name: rm.exercise_name, tested: rm.weight_kg, estimated: 0 })
    }
    for (const est of estimated1RMs) {
      const key = est.exercise_name.toLowerCase()
      const existing = map.get(key)
      if (existing) {
        existing.estimated = est.estimated_1rm
        existing.reps = est.reps
        existing.date = est.date
      } else {
        map.set(key, {
          name: est.exercise_name,
          estimated: est.estimated_1rm,
          reps: est.reps,
          date: est.date,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const aBest = Math.max(a.tested ?? 0, a.estimated)
      const bBest = Math.max(b.tested ?? 0, b.estimated)
      return bBest - aBest
    })
  }, [oneRMs, estimated1RMs])

  // Fetch all exercises once so we can populate the exercise-mode dropdown.
  useEffect(() => {
    let cancelled = false
    fetch('/api/progress/exercises')
      .then((r) => (r.ok ? r.json() : { exercises: [] }))
      .then((d) => {
        if (cancelled) return
        const names = (d.exercises || []).map((e: { name: string }) => e.name)
        setAllExercises(names)
        if (!selectedExercise && names.length > 0) setSelectedExercise(names[0])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch chart data when mode/period/exercise changes.
  useEffect(() => {
    setChartLoading(true)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

    if (mode === 'volume') {
      fetch(`/api/progress/tonnage?period=${period === '3months' ? 'month' : period}&tz=${encodeURIComponent(tz)}&series=1`)
        .then((r) => r.json())
        .then((d) => {
          // If the endpoint returns a series, use it; otherwise synthesize
          // a single-bar view from the scalar total it currently returns.
          if (Array.isArray(d.series)) {
            setVolumePoints(d.series)
          } else {
            setVolumePoints([{ label: labelFor(period), value: d.tonnage ?? 0 }])
          }
        })
        .catch(() => setVolumePoints([]))
        .finally(() => setChartLoading(false))
      return
    }

    if (!selectedExercise) {
      setExercisePoints([])
      setChartLoading(false)
      return
    }

    fetch(
      `/api/progress/progression?exercise=${encodeURIComponent(selectedExercise)}&period=${period}&tz=${encodeURIComponent(tz)}`
    )
      .then((r) => r.json())
      .then((d) => {
        const points: ExercisePoint[] = (d.progression || []).map(
          (p: { date: string; weight: number; reps: number }) => ({
            date: new Date(p.date).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            }),
            weight: p.weight,
            reps: p.reps,
          })
        )
        setExercisePoints(points)
      })
      .catch(() => setExercisePoints([]))
      .finally(() => setChartLoading(false))
  }, [mode, period, selectedExercise])

  return (
    <main className="px-4 py-4 space-y-5">
      {/* 1. Hero stats row */}
      <section className="grid grid-cols-2 gap-2">
        <StatTile
          icon={<Flame className="w-4 h-4 text-orange-400" />}
          label="Streak"
          value={`${streak}`}
          sub={`Best ${longestStreak}`}
        />
        <StatTile
          icon={<Weight className="w-4 h-4 text-blue-400" />}
          label="This Week"
          value={formatTonnage(weeklyTonnage)}
          sub={<TrendBadge pct={tonnageTrendPct} />}
        />
        <StatTile
          icon={<CheckCircle2 className="w-4 h-4 text-green-400" />}
          label="This Month"
          value={`${monthCompletions}`}
          sub={monthScheduled > 0 ? `of ${monthScheduled} scheduled` : 'workouts'}
        />
        <StatTile
          icon={<Trophy className="w-4 h-4 text-yellow-400" />}
          label="PRs tracked"
          value={`${mergedPRs.length}`}
          sub={mergedPRs.length > 0 ? mergedPRs[0].name : 'Add a lift'}
        />
      </section>

      {/* 2. Unified chart card */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          {/* Mode toggle */}
          <div className="inline-flex p-0.5 bg-zinc-800 rounded-lg text-xs">
            <button
              onClick={() => setMode('volume')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                mode === 'volume' ? 'bg-yellow-400 text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Volume
            </button>
            <button
              onClick={() => setMode('exercise')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                mode === 'exercise' ? 'bg-yellow-400 text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Exercise
            </button>
          </div>

          {/* Shared period picker */}
          <div className="flex gap-1 text-[11px]">
            {(['week', 'month', '3months', 'year'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-1 rounded-md transition-colors ${
                  period === p
                    ? 'bg-yellow-400 text-black font-medium'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {p === '3months' ? '3M' : p === 'year' ? '1Y' : p === 'month' ? '1M' : '1W'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'exercise' && (
          <div className="relative mb-3">
            <button
              onClick={() => setExerciseDropdownOpen(!exerciseDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
            >
              <span className="truncate">{selectedExercise || 'Select exercise'}</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform flex-shrink-0 ml-2 ${
                  exerciseDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {exerciseDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg max-h-48 overflow-y-auto z-10">
                {allExercises.length === 0 ? (
                  <p className="px-3 py-2 text-zinc-500 text-sm">No exercises logged yet</p>
                ) : (
                  allExercises.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => {
                        setSelectedExercise(ex)
                        setExerciseDropdownOpen(false)
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-700 transition-colors ${
                        selectedExercise === ex ? 'text-yellow-400' : 'text-white'
                      }`}
                    >
                      {ex}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {chartLoading ? (
          <div className="h-36 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : mode === 'volume' ? (
          <VolumeChart points={volumePoints} />
        ) : (
          <ExerciseChart points={exercisePoints} />
        )}

        {/* Chart footer stats */}
        {mode === 'exercise' && exercisePoints.length > 0 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800 text-xs text-zinc-500">
            <span>Best: {Math.max(...exercisePoints.map((p) => p.weight))}kg</span>
            <span>{exercisePoints.length} sessions</span>
          </div>
        )}
        {mode === 'volume' && volumePoints.length > 0 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800 text-xs text-zinc-500">
            <span>
              Total: {formatTonnage(volumePoints.reduce((s, p) => s + (p.value || 0), 0))}
            </span>
          </div>
        )}
      </section>

      {/* 3. This month recap */}
      {(monthCompletions > 0 || monthScheduled > 0) && (
        <section className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              This month
            </h3>
          </div>
          <p className="text-white text-sm leading-snug">
            You&apos;ve trained{' '}
            <span className="font-bold text-white">{monthCompletions}</span>
            {monthScheduled > 0 ? (
              <>
                {' '}
                of <span className="font-bold text-zinc-300">{monthScheduled}</span> scheduled
                {' '}days so far.
              </>
            ) : (
              <> times so far.</>
            )}{' '}
            Longest streak:{' '}
            <span className="font-bold text-orange-400">{longestStreak}</span>.
          </p>
        </section>
      )}

      {/* 4. Personal Records — unified list */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
            Personal Records
          </h2>
          <Link href="/1rm-tracking" className="text-yellow-400 text-xs font-medium">
            Track & update →
          </Link>
        </div>

        {mergedPRs.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <Dumbbell className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">No PRs recorded yet</p>
            <p className="text-zinc-600 text-xs mt-1">
              Log your workouts to see estimated 1RMs
            </p>
            <Link
              href="/1rm-tracking"
              className="inline-block text-yellow-400 text-sm mt-3"
            >
              Add a lift →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {mergedPRs.slice(0, 6).map((pr) => (
              <PRCard key={pr.name} pr={pr} />
            ))}
          </div>
        )}

        {mergedPRs.length > 6 && (
          <Link
            href="/1rm-tracking"
            className="mt-3 flex items-center justify-center gap-1 text-zinc-400 hover:text-yellow-400 text-xs font-medium transition-colors"
          >
            See all {mergedPRs.length} lifts
            <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </section>

      {/* 5. Progress Photos */}
      <section>
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
          Progress Photos
        </h2>
        {progressImages.length > 0 ? (
          <Link
            href="/progress-pictures"
            className="block bg-zinc-900 border border-zinc-800 hover:border-yellow-400/40 rounded-2xl overflow-hidden transition-colors"
          >
            <div className="grid grid-cols-3 gap-px bg-zinc-800">
              {progressImages.slice(0, 3).map((img) => (
                <div key={img.id} className="relative aspect-square bg-zinc-950">
                  <Image
                    src={img.image_url}
                    alt="Progress"
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 33vw, 200px"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  {progressImages.length} photo{progressImages.length === 1 ? '' : 's'}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Tap to see them all & add a new one
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-yellow-400" />
            </div>
          </Link>
        ) : (
          <Link
            href="/progress-pictures"
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-yellow-400/10 to-yellow-500/5 border border-yellow-400/30 rounded-xl hover:border-yellow-400/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
              <Camera className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">
                Take your first progress photo
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                The best way to see what a mirror can&apos;t.
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-yellow-400" />
          </Link>
        )}
      </section>
    </main>
  )
}

/* ---------- subcomponents ---------- */

function StatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: React.ReactNode
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] uppercase tracking-wider mb-1.5">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold text-white leading-none">{value}</p>
      <p className="text-[11px] text-zinc-500 mt-1.5 truncate">{sub}</p>
    </div>
  )
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-zinc-500">vs last week —</span>
  }
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-zinc-400">
        <Minus className="w-3 h-3" />
        same
      </span>
    )
  }
  const up = pct > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${
        up ? 'text-green-400' : 'text-red-400'
      }`}
    >
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(pct)}%
    </span>
  )
}

function PRCard({
  pr,
}: {
  pr: { name: string; tested?: number; estimated: number; reps?: number; date?: string }
}) {
  const primary = pr.tested ?? pr.estimated
  const hasTested = pr.tested !== undefined
  const estBeatsTested = hasTested && pr.estimated > (pr.tested ?? 0)

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
      <p className="text-xs text-zinc-500 truncate">{pr.name}</p>
      <p className="text-lg font-bold text-white mt-0.5">
        {primary}
        <span className="text-zinc-500 text-xs font-normal"> kg</span>
      </p>
      <p className="text-[10px] mt-0.5 truncate">
        {hasTested ? (
          <span className="text-yellow-400">Tested</span>
        ) : (
          <span className="text-zinc-500">Estimated</span>
        )}
        {estBeatsTested && (
          <span className="text-green-400"> · est {pr.estimated}, time to retest</span>
        )}
        {!hasTested && pr.reps && (
          <span className="text-zinc-500"> · from {pr.reps}×{pr.tested ?? pr.estimated}</span>
        )}
      </p>
    </div>
  )
}

function VolumeChart({ points }: { points: VolumePoint[] }) {
  if (points.length === 0) {
    return (
      <div className="h-36 flex items-center justify-center text-zinc-500 text-sm">
        No volume logged in this period
      </div>
    )
  }
  // If we only have a scalar total (one point), render as a big number.
  if (points.length === 1) {
    return (
      <div className="h-36 flex flex-col items-center justify-center">
        <p className="text-4xl font-bold text-white tabular-nums">
          {formatTonnage(points[0].value)}
        </p>
        <p className="text-xs text-zinc-500 mt-1">{points[0].label}</p>
      </div>
    )
  }
  const max = Math.max(...points.map((p) => p.value), 1)
  return (
    <div className="h-36 flex items-end gap-1">
      {points.map((p, i) => {
        const h = Math.max(4, (p.value / max) * 100)
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-yellow-400/70 hover:bg-yellow-400 rounded-t transition-colors"
              style={{ height: `${h}%` }}
              title={`${p.label}: ${formatTonnage(p.value)}`}
            />
            {points.length <= 12 && (
              <span className="text-[8px] text-zinc-500 truncate w-full text-center">
                {p.label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ExerciseChart({ points }: { points: ExercisePoint[] }) {
  if (points.length === 0) {
    return (
      <div className="h-36 flex items-center justify-center text-zinc-500 text-sm">
        No data yet for this exercise
      </div>
    )
  }
  const max = Math.max(...points.map((p) => p.weight))
  const min = Math.min(...points.map((p) => p.weight))
  const range = max - min || 1

  return (
    <div className="h-36 flex items-end gap-1">
      {points.map((p, i) => {
        const h = ((p.weight - min) / range) * 80 + 20
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-yellow-400/70 hover:bg-yellow-400 rounded-t transition-colors"
              style={{ height: `${h}%` }}
              title={`${p.weight}kg × ${p.reps}`}
            />
            {points.length <= 10 && (
              <span className="text-[8px] text-zinc-500 truncate w-full text-center">
                {p.date.split(' ')[0]}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ---------- helpers ---------- */

function labelFor(p: Period) {
  switch (p) {
    case 'week':
      return 'This Week'
    case 'month':
      return 'This Month'
    case '3months':
      return 'Last 3 Months'
    case 'year':
      return 'This Year'
  }
}

function formatTonnage(kg: number) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`
  return `${Math.round(kg)}kg`
}
