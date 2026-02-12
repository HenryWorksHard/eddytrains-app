import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'week'
    // Get timezone from query param, default to Australia/Adelaide
    const timezone = searchParams.get('tz') || 'Australia/Adelaide'
    
    const adminClient = getAdminClient()
    
    // Calculate date range based on period using user's timezone
    // Use Intl.DateTimeFormat to get the current date in user's timezone
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
      case 'day':
        startDateStr = formatDate(nowInTz)
        break
      case 'week':
        const dayOfWeek = nowInTz.getDay()
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Monday = 0 days back
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

    // Use scheduled_date (local date) instead of completed_at (UTC timestamp)
    const { data: workoutLogs } = await adminClient
      .from('workout_logs')
      .select('id')
      .eq('client_id', clientId)
      .gte('scheduled_date', startDateStr)

    if (!workoutLogs || workoutLogs.length === 0) {
      return NextResponse.json({ tonnage: 0 })
    }

    const workoutLogIds = workoutLogs.map(log => log.id)

    // Then get all set_logs for those workout_logs
    const { data: setLogs } = await adminClient
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
