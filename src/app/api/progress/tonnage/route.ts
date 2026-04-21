import { createClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type Period = 'day' | 'week' | 'month' | '3months' | 'year'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'week') as Period
    const timezone = searchParams.get('tz') || 'UTC'

    const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
    const { startDate, endDate, bucketer } = computeWindow(period, nowInTz)

    // Inclusive day-level window using plain ISO strings built from the
    // local (user-tz) date boundaries. The original pre-rewrite route
    // used exactly this pattern and worked reliably — the !inner-join
    // variant I tried afterwards didn't filter correctly through
    // Supabase's REST layer, which is why the chart went blank.
    const startIso = startOfDayIso(startDate)
    const endIso = endOfDayIso(endDate)

    // Step 1: workout_logs for this client inside the window.
    const { data: logs, error: logsErr } = await supabase
      .from('workout_logs')
      .select('id, completed_at')
      .eq('client_id', user.id)
      .gte('completed_at', startIso)
      .lte('completed_at', endIso)

    if (logsErr) {
      console.error('[tonnage] workout_logs error:', logsErr)
      return NextResponse.json({ tonnage: 0, series: [] })
    }

    if (!logs || logs.length === 0) {
      return NextResponse.json(
        {
          tonnage: 0,
          series: bucketer
            ? bucketer.enumerate(startDate, endDate).map((b) => ({ label: b.label, value: 0 }))
            : [],
          period,
        },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      )
    }

    const logIds = logs.map((l) => l.id as string)
    const completedAtByLogId = new Map<string, string>(
      logs.map((l) => [l.id as string, l.completed_at as string])
    )

    // Step 2: set_logs for those workout_logs.
    const { data: setLogs, error: setsErr } = await supabase
      .from('set_logs')
      .select('weight_kg, reps_completed, workout_log_id')
      .in('workout_log_id', logIds)
      .not('weight_kg', 'is', null)
      .not('reps_completed', 'is', null)

    if (setsErr) {
      console.error('[tonnage] set_logs error:', setsErr)
      return NextResponse.json({ tonnage: 0, series: [] })
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
      total += v

      if (buckets) {
        const completedAt = completedAtByLogId.get(s.workout_log_id as string)
        if (!completedAt) continue
        const key = bucketer!.keyOf(new Date(completedAt))
        const b = buckets.find((x) => x.key === key)
        if (b) b.value += v
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
    startDate.setDate(startDate.getDate() - 6)
    return { startDate, endDate, bucketer: dailyBucketer }
  }
  if (period === 'month') {
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
    return { startDate, endDate, bucketer: weeklyBucketer(startDate) }
  }
  if (period === '3months') {
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 89)
    return { startDate, endDate, bucketer: weeklyBucketer(startDate) }
  }
  if (period === 'year') {
    const startDate = new Date(endDate.getFullYear(), 0, 1)
    return { startDate, endDate, bucketer: monthlyBucketer }
  }
  return { startDate: endDate, endDate, bucketer: null }
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
  const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  const keyFor = (d: Date) => {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const weeks = Math.floor((t - startMs) / (7 * 24 * 60 * 60 * 1000))
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
          label: cursor.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
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
function startOfDayIso(d: Date) {
  return `${formatYmd(d)}T00:00:00.000Z`
}
function endOfDayIso(d: Date) {
  return `${formatYmd(d)}T23:59:59.999Z`
}
