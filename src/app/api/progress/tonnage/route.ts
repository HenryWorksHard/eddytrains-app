import { createClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type Period = 'day' | 'week' | 'month' | '3months' | 'year'

type JoinedSetLog = {
  weight_kg: number | null
  reps_completed: number | null
  workout_logs: { client_id: string; completed_at: string | null } | null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'week') as Period
    const timezone = searchParams.get('tz') || 'UTC'

    const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))

    // Determine the analysis window + how to bucket values into bars.
    // 'day' is intentionally kept scalar (no series).
    const { startDate, endDate, bucketer } = computeWindow(period, nowInTz)

    const startIso = startDate.toISOString()
    const endIso = new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()

    // Single relational query: all set_logs for this user whose parent
    // workout_log.completed_at falls inside the window.
    const { data: setLogs, error } = await supabase
      .from('set_logs')
      .select(`
        weight_kg,
        reps_completed,
        workout_logs!inner(client_id, completed_at)
      `)
      .eq('workout_logs.client_id', user.id)
      .gte('workout_logs.completed_at', startIso)
      .lte('workout_logs.completed_at', endIso)
      .not('weight_kg', 'is', null)
      .not('reps_completed', 'is', null)
      .returns<JoinedSetLog[]>()

    if (error) {
      console.error('[tonnage] query error:', error)
      return NextResponse.json({ tonnage: 0, series: [] })
    }

    // Aggregate into buckets.
    const buckets = bucketer
      ? makeEmptyBuckets(bucketer, startDate, endDate)
      : null
    let total = 0

    for (const log of setLogs || []) {
      const w = log.weight_kg ?? 0
      const r = log.reps_completed ?? 0
      if (!w || !r) continue
      const v = w * r
      total += v

      if (buckets && log.workout_logs?.completed_at) {
        const key = bucketer!.keyOf(new Date(log.workout_logs.completed_at))
        const idx = buckets.findIndex((b) => b.key === key)
        if (idx !== -1) buckets[idx].value += v
      }
    }

    const series = buckets
      ? buckets.map((b) => ({ label: b.label, value: Math.round(b.value) }))
      : []

    return NextResponse.json(
      {
        tonnage: Math.round(total),
        series,
        period,
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (error) {
    console.error('[tonnage] error:', error)
    return NextResponse.json({ error: 'Failed to fetch tonnage' }, { status: 500 })
  }
}

/* ---------- windowing + bucketing ---------- */

type Bucketer = {
  keyOf: (d: Date) => string
  enumerate: (start: Date, end: Date) => { key: string; label: string }[]
}

function computeWindow(period: Period, nowInTz: Date): {
  startDate: Date
  endDate: Date
  bucketer: Bucketer | null
} {
  const endDate = new Date(nowInTz.getFullYear(), nowInTz.getMonth(), nowInTz.getDate())

  if (period === 'day') {
    return { startDate: endDate, endDate, bucketer: null }
  }

  if (period === 'week') {
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 6) // last 7 days including today
    return { startDate, endDate, bucketer: dailyBucketer }
  }

  if (period === 'month') {
    // Calendar month to date — group by 7-day weeks.
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
    return { startDate, endDate, bucketer: weeklyBucketer(startDate) }
  }

  if (period === '3months') {
    // Last 90 days, grouped by week.
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 89)
    return { startDate, endDate, bucketer: weeklyBucketer(startDate) }
  }

  if (period === 'year') {
    // Calendar year to date — group by month.
    const startDate = new Date(endDate.getFullYear(), 0, 1)
    return { startDate, endDate, bucketer: monthlyBucketer }
  }

  return { startDate: endDate, endDate, bucketer: null }
}

function makeEmptyBuckets(
  b: Bucketer,
  start: Date,
  end: Date
): { key: string; label: string; value: number }[] {
  return b.enumerate(start, end).map((x) => ({ ...x, value: 0 }))
}

const dailyBucketer: Bucketer = {
  keyOf: (d) => formatYmd(d),
  enumerate: (start, end) => {
    const out: { key: string; label: string }[] = []
    const cursor = new Date(start)
    while (cursor <= end) {
      out.push({
        key: formatYmd(cursor),
        label: cursor.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    return out
  },
}

function weeklyBucketer(start: Date): Bucketer {
  // Each bucket is a 7-day span starting at `start`. keyOf returns the
  // week-index based on days since `start` / 7.
  const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()

  const keyFor = (d: Date) => {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const weeks = Math.floor((t - startMs) / (7 * 24 * 60 * 60 * 1000))
    return `w${weeks}`
  }
  return {
    keyOf: keyFor,
    enumerate: (s, e) => {
      const out: { key: string; label: string }[] = []
      const cursor = new Date(s)
      let idx = 0
      while (cursor <= e) {
        const labelDate = new Date(cursor)
        out.push({
          key: `w${idx}`,
          label: labelDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        })
        cursor.setDate(cursor.getDate() + 7)
        idx++
      }
      return out
    },
  }
}

const monthlyBucketer: Bucketer = {
  keyOf: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
  enumerate: (start, end) => {
    const out: { key: string; label: string }[] = []
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cursor <= end) {
      out.push({
        key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
        label: cursor.toLocaleDateString(undefined, { month: 'short' }),
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return out
  },
}

function formatYmd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
