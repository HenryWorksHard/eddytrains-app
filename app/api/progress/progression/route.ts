import { createClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const exerciseName = searchParams.get('exercise')
    const period = searchParams.get('period') || 'month'
    const timezone = searchParams.get('tz') || 'Australia/Adelaide'
    
    if (!exerciseName) {
      return NextResponse.json({ error: 'Exercise name required' }, { status: 400 })
    }

    // Calculate date range based on period using user's timezone
    const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
    
    // Helper to format date as YYYY-MM-DD
    const formatDate = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    let startDateStr: string
    
    switch (period) {
      case 'week':
        const weekStart = new Date(nowInTz)
        weekStart.setDate(nowInTz.getDate() - 7)
        startDateStr = formatDate(weekStart)
        break
      case 'month':
        const monthStart = new Date(nowInTz)
        monthStart.setMonth(nowInTz.getMonth() - 1)
        startDateStr = formatDate(monthStart)
        break
      case '3months':
        const threeMonthStart = new Date(nowInTz)
        threeMonthStart.setMonth(nowInTz.getMonth() - 3)
        startDateStr = formatDate(threeMonthStart)
        break
      case 'year':
        const yearStart = new Date(nowInTz)
        yearStart.setFullYear(nowInTz.getFullYear() - 1)
        startDateStr = formatDate(yearStart)
        break
      case 'all':
        startDateStr = '2020-01-01'
        break
      default:
        const defaultStart = new Date(nowInTz)
        defaultStart.setMonth(nowInTz.getMonth() - 1)
        startDateStr = formatDate(defaultStart)
    }

    // Use scheduled_date (local date)
    const { data: workoutLogs } = await supabase
      .from('workout_logs')
      .select('id, completed_at, scheduled_date')
      .eq('client_id', user.id)
      .gte('scheduled_date', startDateStr)
      .order('scheduled_date', { ascending: true })

    if (!workoutLogs || workoutLogs.length === 0) {
      return NextResponse.json({ progression: [] })
    }

    const workoutLogIds = workoutLogs.map(log => log.id)

    // Get workout_exercises that match the exercise name
    const { data: matchingExercises } = await supabase
      .from('workout_exercises')
      .select('id')
      .ilike('exercise_name', exerciseName)

    if (!matchingExercises || matchingExercises.length === 0) {
      return NextResponse.json({ progression: [] })
    }

    const exerciseIds = matchingExercises.map(e => e.id)

    // Get set_logs for these exercises and workout_logs
    const { data: setLogs } = await supabase
      .from('set_logs')
      .select('workout_log_id, weight_kg, reps_completed')
      .in('workout_log_id', workoutLogIds)
      .in('exercise_id', exerciseIds)
      .not('weight_kg', 'is', null)
      .order('created_at', { ascending: true })

    if (!setLogs || setLogs.length === 0) {
      return NextResponse.json({ progression: [] })
    }

    // Group by workout_log and get max weight per session
    const workoutLogMap = new Map(workoutLogs.map(log => [log.id, log]))
    const sessionWeights = new Map<string, { date: string; maxWeight: number; maxReps: number }>()

    setLogs.forEach(log => {
      const workoutLog = workoutLogMap.get(log.workout_log_id)
      if (!workoutLog) return

      const dateStr = workoutLog.scheduled_date || workoutLog.completed_at.split('T')[0]
      const existing = sessionWeights.get(dateStr)
      
      if (!existing || log.weight_kg > existing.maxWeight) {
        sessionWeights.set(dateStr, {
          date: dateStr,
          maxWeight: log.weight_kg,
          maxReps: log.reps_completed || 0
        })
      }
    })

    // Convert to array and sort by date
    const progression = Array.from(sessionWeights.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        date: item.date,
        weight: item.maxWeight,
        reps: item.maxReps
      }))

    return NextResponse.json({ progression })
  } catch (error) {
    console.error('Progression fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch progression' }, { status: 500 })
  }
}
