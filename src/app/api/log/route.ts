import { createClient } from '../../lib/supabase/server'
import { formatDateToString, parseLocalDate } from '../../lib/dateUtils'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const todayParam = searchParams.get('today')
  const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(todayParam || '')
    ? todayParam!
    : formatDateToString(new Date())

  // Get user's active programs with workouts
  const { data: clientPrograms } = await supabase
    .from('client_programs')
    .select(`
      id,
      program_id,
      start_date,
      duration_weeks,
      programs (
        id,
        name,
        category,
        program_workouts (
          id,
          name,
          day_of_week,
          week_number,
          parent_workout_id,
          workout_exercises (
            id,
            exercise_name,
            exercise_uuid,
            order_index,
            notes,
            superset_group,
            exercise_sets (
              set_number,
              reps,
              intensity_type,
              intensity_value,
              rest_seconds
            )
          )
        )
      )
    `)
    .eq('client_id', user.id)
    .eq('is_active', true)

  // Compute maxWeek (across all active programs) and programStartDate
  // (earliest active start), matching the dashboard formula.
  let maxWeek = 1
  let programStartDate: string | undefined = undefined
  if (clientPrograms) {
    for (const cp of clientPrograms) {
      if (cp.start_date && (!programStartDate || cp.start_date < programStartDate)) {
        programStartDate = cp.start_date
      }
      const programData = cp.programs as unknown
      const program = (Array.isArray(programData) ? programData[0] : programData) as {
        program_workouts?: { week_number?: number | null }[]
      } | null
      program?.program_workouts?.forEach((w) => {
        if (w.week_number) maxWeek = Math.max(maxWeek, w.week_number)
      })
    }
  }

  // Current-week formula (mirrors dashboard route).
  let currentWeek = 1
  if (programStartDate) {
    const programStart = parseLocalDate(programStartDate)
    const todayLocal = parseLocalDate(todayStr)
    if (todayLocal >= programStart) {
      const diffMs = todayLocal.getTime() - programStart.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const rawWeek = Math.floor(diffDays / 7) + 1
      // Linear progression: clamp to last week once program ends. See
      // dashboard/route.ts for rationale.
      currentWeek = maxWeek > 0 ? Math.min(rawWeek, maxWeek) : rawWeek
    }
  }

  // Build schedule by day of week — ONLY workouts for the current week
  // (or legacy rows with null week_number). Skip finisher children.
  const scheduleByDay: Record<number, any[]> = {}

  for (let i = 0; i < 7; i++) {
    scheduleByDay[i] = []
  }

  if (clientPrograms) {
    for (const cp of clientPrograms) {
      const programData = cp.programs as any
      const program = Array.isArray(programData) ? programData[0] : programData

      if (program?.program_workouts) {
        for (const workout of program.program_workouts) {
          if (workout.parent_workout_id) continue // skip finishers
          if (workout.day_of_week === null) continue

          const wk = workout.week_number
          // Keep legacy rows (null week) + rows for current week only.
          if (wk !== null && wk !== undefined && wk !== currentWeek) continue

          const exercises = (workout.workout_exercises || [])
            .sort((a: any, b: any) => a.order_index - b.order_index)
            .map((ex: any) => ({
              id: ex.id,
              name: ex.exercise_name,
              exercise_uuid: ex.exercise_uuid,  // Global exercise ID
              orderIndex: ex.order_index,
              notes: ex.notes,
              supersetGroup: ex.superset_group,
              sets: (ex.exercise_sets || [])
                .sort((a: any, b: any) => a.set_number - b.set_number)
                .map((s: any) => ({
                  setNumber: s.set_number,
                  reps: s.reps,
                  intensityType: s.intensity_type,
                  intensityValue: s.intensity_value
                }))
            }))

          scheduleByDay[workout.day_of_week].push({
            workoutId: workout.id,
            workoutName: workout.name,
            programName: program.name,
            programCategory: program.category || 'strength',
            clientProgramId: cp.id,
            exercises
          })
        }
      }
    }
  }

  return NextResponse.json({
    scheduleByDay,
    currentWeek,
    maxWeek,
    programStartDate,
  })
}
