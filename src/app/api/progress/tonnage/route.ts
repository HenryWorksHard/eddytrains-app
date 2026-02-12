import { createClient } from '@/app/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Disable caching for this route
export const dynamic = 'force-dynamic'

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

    // Query workout_logs with date filter directly in SQL for accuracy
    // Use scheduled_date for filtering (primary date field)
    const { data: filteredLogs, error: logsError } = await supabase
      .from('workout_logs')
      .select('id, scheduled_date')
      .eq('client_id', user.id)
      .gte('scheduled_date', startDateStr)
      .lte('scheduled_date', endDateStr)

    if (logsError) {
      console.error('Workout logs query error:', logsError)
      return NextResponse.json({ tonnage: 0, error: logsError.message })
    }

    if (!filteredLogs || filteredLogs.length === 0) {
      return NextResponse.json({ 
        tonnage: 0, 
        debug: { startDateStr, endDateStr, period, logsFound: 0, userId: user.id }
      })
    }

    const workoutLogIds = filteredLogs.map(log => log.id)

    // Get all set_logs for those workout_logs
    const { data: setLogs, error: setsError } = await supabase
      .from('set_logs')
      .select('weight_kg, reps_completed')
      .in('workout_log_id', workoutLogIds)

    if (setsError) {
      console.error('Set logs query error:', setsError)
      return NextResponse.json({ tonnage: 0, error: setsError.message })
    }

    if (!setLogs || setLogs.length === 0) {
      return NextResponse.json({ 
        tonnage: 0, 
        debug: { startDateStr, endDateStr, period, workoutLogIds, setLogsFound: 0 }
      })
    }

    // Calculate total tonnage (weight × reps for each set)
    const totalTonnage = setLogs.reduce((sum, set) => {
      return sum + ((set.weight_kg || 0) * (set.reps_completed || 0))
    }, 0)

    // Return with no-cache headers
    return NextResponse.json({ 
      tonnage: Math.round(totalTonnage),
      debug: { 
        startDateStr, 
        endDateStr, 
        period, 
        workoutLogsCount: filteredLogs.length,
        setLogsCount: setLogs.length,
        userId: user.id
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    })
  } catch (error) {
    console.error('Tonnage fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch tonnage' }, { status: 500 })
  }
}
