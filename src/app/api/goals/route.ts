import { createClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type GoalKind = 'lift' | 'workouts' | 'body_weight' | 'custom'

/**
 * GET /api/goals
 *
 * Returns the client's goals with `current_value` computed dynamically
 * where possible:
 *
 *   lift       → max tested 1RM for `metric` from client_1rms
 *   workouts   → count of workout_completions since goal.created_at
 *   body_weight → TODO: will hit body_metrics once that feature lands
 *   custom     → whatever the client has manually saved
 *
 * Goals with a computed current_value >= target_value get auto-marked
 * as achieved (achieved_at set to now).
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: goals, error } = await supabase
    .from('client_goals')
    .select('*')
    .eq('client_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[goals] fetch error:', error)
    return NextResponse.json({ error: 'Failed to load goals' }, { status: 500 })
  }

  if (!goals || goals.length === 0) {
    return NextResponse.json({ goals: [] })
  }

  // Batch the dynamic computations.
  const needsOneRMs = goals.some((g) => g.kind === 'lift')
  const needsCompletions = goals.some((g) => g.kind === 'workouts')

  const [oneRMsResult, completionsResult] = await Promise.all([
    needsOneRMs
      ? supabase
          .from('client_1rms')
          .select('exercise_name, weight_kg')
          .eq('client_id', user.id)
      : Promise.resolve({ data: [] as { exercise_name: string; weight_kg: number }[] }),
    needsCompletions
      ? supabase
          .from('workout_completions')
          .select('client_id, scheduled_date, created_at')
          .eq('client_id', user.id)
      : Promise.resolve({ data: [] as { scheduled_date: string; created_at: string }[] }),
  ])

  const oneRMsByExercise = new Map<string, number>()
  for (const rm of oneRMsResult.data || []) {
    const key = (rm.exercise_name || '').toLowerCase().trim()
    if (!key) continue
    oneRMsByExercise.set(key, Math.max(oneRMsByExercise.get(key) || 0, Number(rm.weight_kg || 0)))
  }

  const completions = completionsResult.data || []

  const enriched = goals.map((g) => {
    let currentValue = Number(g.current_value || 0)

    if (g.kind === 'lift' && g.metric) {
      currentValue = oneRMsByExercise.get(g.metric.toLowerCase().trim()) || 0
    } else if (g.kind === 'workouts') {
      const since = g.created_at
      currentValue = completions.filter((c) => (c.created_at || '') >= since).length
    }

    const target = g.target_value !== null ? Number(g.target_value) : null
    const achieved =
      g.achieved_at !== null ||
      (target !== null && target > 0 && currentValue >= target)

    return {
      ...g,
      current_value: currentValue,
      target_value: target,
      achieved,
    }
  })

  // Opportunistically flip just-achieved goals to achieved.
  const newlyAchieved = enriched.filter(
    (g) => g.achieved && !g.achieved_at
  )
  if (newlyAchieved.length > 0) {
    await supabase
      .from('client_goals')
      .update({ achieved_at: new Date().toISOString() })
      .in('id', newlyAchieved.map((g) => g.id))
  }

  return NextResponse.json({ goals: enriched })
}

/**
 * POST /api/goals
 * Body: { title, kind, metric?, target_value?, target_date? }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, kind, metric, target_value, target_date } = body

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  const validKinds: GoalKind[] = ['lift', 'workouts', 'body_weight', 'custom']
  if (!validKinds.includes(kind)) {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('client_goals')
    .insert({
      client_id: user.id,
      created_by: user.id,
      title: title.trim(),
      kind,
      metric: metric ? String(metric).trim() : null,
      target_value: target_value !== undefined && target_value !== '' ? Number(target_value) : null,
      target_date: target_date || null,
    })
    .select()
    .single()

  if (error) {
    console.error('[goals] insert error:', error)
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
  }

  return NextResponse.json({ goal: data })
}
