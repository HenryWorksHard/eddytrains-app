import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized, forbidden, authorizeUserAccess } from '@/app/lib/auth-guard'

/**
 * GET /api/users/[id]/goals
 *
 * Trainer-facing mirror of the client's `/api/goals` GET handler. Computes
 * the same dynamic `current_value` / `achieved` enrichment for the target
 * client. Auth: super_admin, same-org trainer, or self (client reading
 * their own id) — enforced via `authorizeUserAccess`.
 *
 * Response shape: identical to `/api/goals` (see src/app/api/goals/route.ts
 * for the field-by-field documentation).
 */
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return unauthorized()
    const { id: clientId } = await params
    const gate = await authorizeUserAccess(ctx, clientId)
    if (!gate.profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (!gate.allowed) return forbidden()

    const admin = getAdminClient()

    const { data: goals, error } = await admin
      .from('client_goals')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[users/goals] fetch error:', error)
      return NextResponse.json({ error: 'Failed to load goals' }, { status: 500 })
    }

    if (!goals || goals.length === 0) {
      return NextResponse.json({ goals: [] })
    }

    const needsOneRMs = goals.some((g) => g.kind === 'lift')
    const needsCompletions = goals.some((g) => g.kind === 'workouts')

    const [oneRMsResult, completionsResult] = await Promise.all([
      needsOneRMs
        ? admin
            .from('client_1rms')
            .select('exercise_name, weight_kg')
            .eq('client_id', clientId)
        : Promise.resolve({ data: [] as { exercise_name: string; weight_kg: number }[] }),
      needsCompletions
        ? admin
            .from('workout_completions')
            .select('client_id, scheduled_date, created_at')
            .eq('client_id', clientId)
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

    // Opportunistically flip just-achieved goals (same behavior as client route).
    const newlyAchieved = enriched.filter((g) => g.achieved && !g.achieved_at)
    if (newlyAchieved.length > 0) {
      await admin
        .from('client_goals')
        .update({ achieved_at: new Date().toISOString() })
        .in('id', newlyAchieved.map((g) => g.id))
    }

    return NextResponse.json({ goals: enriched })
  } catch (error) {
    console.error('[users/goals] error:', error)
    return NextResponse.json({ error: 'Failed to load goals' }, { status: 500 })
  }
}
