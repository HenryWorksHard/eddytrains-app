import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '../components/BottomNav'
import PageHeader from '../components/PageHeader'
import ProgressClient from './ProgressClient'

export const dynamic = 'force-dynamic'

export default async function ProgressPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch 1RMs
  const { data: oneRMs } = await supabase
    .from('client_1rms')
    .select('exercise_name, weight_kg, updated_at')
    .eq('client_id', user.id)
    .order('weight_kg', { ascending: false })

  // Fetch progress images
  const { data: progressImages } = await supabase
    .from('progress_images')
    .select('id, image_url, created_at')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })
    .limit(12)

  // Fetch recent workout logs for tonnage calculation
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  
  const { data: recentLogs } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('client_id', user.id)
    .gte('completed_at', weekAgo.toISOString())
  
  const logIds = recentLogs?.map(l => l.id) || []
  
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

  return (
    <div className="min-h-screen bg-black pb-24">
      <PageHeader title="Progress" />
      <ProgressClient 
        oneRMs={oneRMs || []}
        progressImages={progressImages || []}
        weeklyTonnage={weeklyTonnage}
      />
      <BottomNav />
    </div>
  )
}
