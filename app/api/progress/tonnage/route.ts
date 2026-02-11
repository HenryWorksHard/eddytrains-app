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
    let endDateStr: string | null = null
    
    switch (period) {
      case 'day':
        // Only today - exact match
        startDateStr = todayStr
        endDateStr = todayStr
        break
      case 'week':
        const dayOfWeek = nowInTz.getDay()
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        const weekStart = new Date(nowInTz)
        weekStart.setDate(nowInTz.getDate() - daysFromMonday)
        startDateStr = formatDate(weekStart)
        endDateStr = todayStr
        break
      case 'month':
        startDateStr = `${nowInTz.getFullYear()}-${String(nowInTz.getMonth() + 1).padStart(2, '0')}-01`
        endDateStr = todayStr
        break
      case 'year':
        startDateStr = `${nowInTz.getFullYear()}-01-01`
        endDateStr = todayStr
        break
      default:
        const defaultStart = new Date(nowInTz)
        defaultStart.setDate(nowInTz.getDate() - 7)
        startDateStr = formatDate(defaultStart)
        endDateStr = todayStr
    }

    // Query using scheduled_date with proper range
    let query = supabase
      .from('workout_logs')
      .select('id, scheduled_date, completed_at')
      .eq('client_id', user.id)
      .gte('scheduled_date', startDateStr)
    
    if (endDateStr) {
      query = query.lte('scheduled_date', endDateStr)
    }
    
    let { data: workoutLogs } = await query

    // If no results with scheduled_date, try completed_at with date extraction
    if (!workoutLogs || workoutLogs.length === 0) {
      // Get all logs and filter by date manually
      const { data: allLogs } = await supabase
        .from('workout_logs')
        .select('id, scheduled_date, completed_at')
        .eq('client_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(100)
      
      // Filter by completed_at date (extract date part)
      workoutLogs = allLogs?.filter(log => {
        const logDate = log.scheduled_date || (log.completed_at ? log.completed_at.split('T')[0] : null)
        if (!logDate) return false
        
        if (period === 'day') {
          return logDate === todayStr
        }
        return logDate >= startDateStr && (!endDateStr || logDate <= endDateStr)
      }) || []
    }

    if (!workoutLogs || workoutLogs.length === 0) {
      return NextResponse.json({ tonnage: 0 })
    }

    const workoutLogIds = workoutLogs.map(log => log.id)

    // Get all set_logs for those workout_logs
    const { data: setLogs } = await supabase
      .from('set_logs')
      .select('weight_kg, reps_completed')
      .in('workout_log_id', workoutLogIds)

    if (!setLogs) {
      return NextResponse.json({ tonnage: 0 })
    }

    // Calculate total tonnage (weight × reps for each set)
    const totalTonnage = setLogs.reduce((sum, set) => {
      return sum + ((set.weight_kg || 0) * (set.reps_completed || 0))
    }, 0)

    return NextResponse.json({ tonnage: Math.round(totalTonnage) })
  } catch (error) {
    console.error('Tonnage fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch tonnage' }, { status: 500 })
  }
}
