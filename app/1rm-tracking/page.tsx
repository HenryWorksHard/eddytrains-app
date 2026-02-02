import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '../components/BottomNav'
import OneRMClient from './OneRMClient'

export default async function OneRMPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch 1RMs
  const { data: oneRMs } = await supabase
    .from('client_1rms')
    .select('*')
    .eq('client_id', user.id)

  return (
    <div className="min-h-screen bg-black pb-24">
      <OneRMClient initialOneRMs={oneRMs || []} />
      <BottomNav />
    </div>
  )
}
