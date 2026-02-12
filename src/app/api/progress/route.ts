import { createClient } from '../../lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  // Run all queries in parallel
  const [oneRMsResult, progressImagesResult, recentLogsResult] = await Promise.all([
    supabase
      .from('client_1rms')
      .select('exercise_name, weight_kg, updated_at')
      .eq('client_id', user.id)
      .order('weight_kg', { ascending: false }),
    
    supabase
      .from('progress_images')
      .select('id, image_url, created_at')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12),
    
    supabase
      .from('workout_logs')
      .select('id')
      .eq('client_id', user.id)
      .gte('completed_at', weekAgo.toISOString())
  ])

  const oneRMs = oneRMsResult.data || []
  const progressImages = progressImagesResult.data || []
  const logIds = recentLogsResult.data?.map(l => l.id) || []
  
  let weeklyTonnage = 0
  if (logIds.length > 0) {
    const { data: setLogs } = await supabase
      .from('set_logs')
      .select('weight_kg, reps_completed')
      .in('workout_log_id', logIds)
    
    weeklyTonnage = setLogs?.reduce((sum, s) => {
      return sum + ((s.weight_kg || 0) * (s.reps_completed || 0))
    }, 0) || 0
  }

  return NextResponse.json({
    oneRMs,
    progressImages,
    weeklyTonnage
  })
}
