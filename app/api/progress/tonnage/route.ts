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
    const period = searchParams.get('period') || 'week'
    const timezone = searchParams.get('tz') || 'Australia/Adelaide'
    
    // Calculate date range based on period using user's timezone
    const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
    
    // Helper to format date as YYYY-MM-DD
    const formatDate = (d: Date) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    const todayStr = formatDate(nowInTz)
    let startDateStr: string
    let endDateStr: string = todayStr
    
    switch (period) {
      case 'day':
        startDateStr = todayStr
        endDateStr = todayStr
        break
      case 'week':
        const dayOfWeek = nowInTz.getDay()
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        const weekStart = new Date(nowInTz)
        weekStart.setDate(nowInTz.getDate() - daysFromMonday)
        startDateStr = formatDate(weekStart)
        break
      case 'month':
        startDateStr = `${nowInTz.getFullYear()}-${String(nowInTz.getMonth() + 1).padStart(2, '0')}-01`
        break
      case 'year':
        startDateStr = `${nowInTz.getFullYear()}-01-01`
        break
      default:
        const defaultStart = new Date(nowInTz)
        defaultStart.setDate(nowInTz.getDate() - 7)
        startDateStr = formatDate(defaultStart)
    }

    // Get ALL workout logs for this user, then filter by date
    // This handles both scheduled_date and completed_at scenarios
    const { data: allLogs } = await supabase
      .from('workout_logs')
      .select('id, scheduled_date, completed_at')
      .eq('client_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(200)

    if (!allLogs || allLogs.length === 0) {
      return NextResponse.json({ tonnage: 0, debug: { startDateStr, endDateStr, period, logsFound: 0 } })
    }

    // Filter logs by date range
    // Use scheduled_date if available, otherwise extract date from completed_at
    const filteredLogs = allLogs.filter(log => {
      // Get the effective date for this log
      let logDate: string | null = null
      
      if (log.scheduled_date) {
        logDate = log.scheduled_date
      } else if (log.completed_at) {
        // Extract date from completed_at timestamp
        // Convert to user's timezone first
        const completedDate = new Date(log.completed_at)
        const completedInTz = new Date(completedDate.toLocaleString('en-US', { timeZone: timezone }))
        logDate = formatDate(completedInTz)
      }
      
      if (!logDate) return false
      
      // Check if within range
      return logDate >= startDateStr && logDate <= endDateStr
    })

    if (filteredLogs.length === 0) {
      return NextResponse.json({ tonnage: 0, debug: { startDateStr, endDateStr, period, logsFound: allLogs.length, filteredCount: 0 } })
    }

    const workoutLogIds = filteredLogs.map(log => log.id)

    // Get all set_logs for those workout_logs
    const { data: setLogs } = await supabase
      .from('set_logs')
      .select('weight_kg, reps_completed')
      .in('workout_log_id', workoutLogIds)

    if (!setLogs || setLogs.length === 0) {
      return NextResponse.json({ tonnage: 0, debug: { startDateStr, endDateStr, workoutLogIds, setLogsFound: 0 } })
    }

    // Calculate total tonnage (weight × reps for each set)
    const totalTonnage = setLogs.reduce((sum, set) => {
      return sum + ((set.weight_kg || 0) * (set.reps_completed || 0))
    }, 0)

    return NextResponse.json({ 
      tonnage: Math.round(totalTonnage),
      debug: { startDateStr, endDateStr, period, workoutLogIds, setLogsCount: setLogs.length }
    })
  } catch (error) {
    console.error('Tonnage fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch tonnage' }, { status: 500 })
  }
}
