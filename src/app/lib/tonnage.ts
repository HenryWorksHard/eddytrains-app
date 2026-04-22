/**
 * Shared tonnage computation used by both client-facing `/api/progress/tonnage`
 * and trainer-facing `/api/users/[id]/tonnage`. Produces a tz-aware bucketed
 * series so both views align on day boundaries.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type Period = 'day' | 'week' | 'month' | '3months' | 'year'

export type TonnagePoint = { label: string; value: number }

export type TonnageResult = {
  tonnage: number
  series: TonnagePoint[]
  period: Period
}

type Bucketer = {
  keyOf: (d: Date) => string
  enumerate: (start: Date, end: Date) => { key: string; label: string }[]
}

export async function computeTonnage(
  supabase: SupabaseClient,
  clientId: string,
  period: Period,
  timezone: string
): Promise<TonnageResult> {
  const { y, m, d } = ymdInTz(new Date(), timezone)
  const endDate = new Date(Date.UTC(y, m - 1, d))
  const { startDate, bucketer } = computeWindow(period, endDate)

  // Widen query window by a day on each side to cover tz offsets.
  const startIso = new Date(startDate.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const endIso = new Date(endDate.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()

  const { data: logs, error: logsErr } = await supabase
    .from('workout_logs')
    .select('id, completed_at')
    .eq('client_id', clientId)
    .gte('completed_at', startIso)
    .lte('completed_at', endIso)

  if (logsErr) {
    console.error('[tonnage] workout_logs error:', logsErr)
    return { tonnage: 0, series: [], period }
  }

  const emptySeries = bucketer
    ? bucketer.enumerate(startDate, endDate).map((b) => ({ label: b.label, value: 0 }))
    : []

  if (!logs || logs.length === 0) {
    return { tonnage: 0, series: emptySeries, period }
  }

  const logIds = logs.map((l) => l.id as string)
  const completedAtByLogId = new Map<string, string>(
    logs.map((l) => [l.id as string, l.completed_at as string])
  )

  const { data: setLogs, error: setsErr } = await supabase
    .from('set_logs')
    .select('weight_kg, reps_completed, workout_log_id')
    .in('workout_log_id', logIds)
    .not('weight_kg', 'is', null)
    .not('reps_completed', 'is', null)

  if (setsErr) {
    console.error('[tonnage] set_logs error:', setsErr)
    return { tonnage: 0, series: [], period }
  }

  const keyByLogId = new Map<string, string | null>()
  if (bucketer) {
    for (const [id, completedAt] of completedAtByLogId) {
      const parts = ymdInTz(new Date(completedAt), timezone)
      const localDate = new Date(Date.UTC(parts.y, parts.m - 1, parts.d))
      keyByLogId.set(id, bucketer.keyOf(localDate))
    }
  }

  let total = 0
  const buckets = bucketer
    ? bucketer.enumerate(startDate, endDate).map((b) => ({ ...b, value: 0 }))
    : null

  for (const s of setLogs || []) {
    const w = Number(s.weight_kg ?? 0)
    const r = Number(s.reps_completed ?? 0)
    if (!w || !r) continue
    const v = w * r

    if (buckets) {
      const key = keyByLogId.get(s.workout_log_id as string)
      if (!key) continue
      const b = buckets.find((x) => x.key === key)
      if (b) {
        b.value += v
        total += v
      }
    } else {
      total += v
    }
  }

  const series = buckets
    ? buckets.map((b) => ({ label: b.label, value: Math.round(b.value) }))
    : []

  return { tonnage: Math.round(total), series, period }
}

/* ---------- windowing + bucketing ---------- */

function computeWindow(period: Period, endDate: Date): {
  startDate: Date
  bucketer: Bucketer | null
} {
  if (period === 'day') {
    return { startDate: endDate, bucketer: null }
  }
  if (period === 'week') {
    const startDate = addUtcDays(endDate, -6)
    return { startDate, bucketer: dailyBucketer }
  }
  if (period === 'month') {
    const startDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1))
    return { startDate, bucketer: weeklyBucketer(startDate) }
  }
  if (period === '3months') {
    const startDate = addUtcDays(endDate, -89)
    return { startDate, bucketer: weeklyBucketer(startDate) }
  }
  if (period === 'year') {
    const startDate = new Date(Date.UTC(endDate.getUTCFullYear(), 0, 1))
    return { startDate, bucketer: monthlyBucketer }
  }
  return { startDate: endDate, bucketer: null }
}

const dailyBucketer: Bucketer = {
  keyOf: (d) => formatYmdUtc(d),
  enumerate: (start, end) => {
    const out: { key: string; label: string }[] = []
    const cursor = new Date(start)
    while (cursor <= end) {
      out.push({
        key: formatYmdUtc(cursor),
        label: cursor.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' }).slice(0, 2),
      })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return out
  },
}

function weeklyBucketer(start: Date): Bucketer {
  const startMs = start.getTime()
  const keyFor = (d: Date) => {
    const weeks = Math.floor((d.getTime() - startMs) / (7 * 24 * 60 * 60 * 1000))
    return `w${Math.max(0, weeks)}`
  }
  return {
    keyOf: keyFor,
    enumerate: (s, e) => {
      const out: { key: string; label: string }[] = []
      const cursor = new Date(s)
      let idx = 0
      while (cursor <= e) {
        out.push({
          key: `w${idx}`,
          label: cursor.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
        })
        cursor.setUTCDate(cursor.getUTCDate() + 7)
        idx++
      }
      return out
    },
  }
}

const monthlyBucketer: Bucketer = {
  keyOf: (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
  enumerate: (start, end) => {
    const out: { key: string; label: string }[] = []
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
    while (cursor <= end) {
      out.push({
        key: `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`,
        label: cursor.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }),
      })
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
    return out
  },
}

function ymdInTz(d: Date, tz: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { y: get('year'), m: get('month'), d: get('day') }
}

function formatYmdUtc(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function addUtcDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setUTCDate(c.getUTCDate() + n)
  return c
}
