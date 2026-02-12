import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '../components/BottomNav'
import ProgressPicturesClient from './ProgressPicturesClient'

export default async function ProgressPicturesPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch progress images
  const { data: images } = await supabase
    .from('progress_images')
    .select('*')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-black pb-24">
      <ProgressPicturesClient initialImages={images || []} />
      <BottomNav />
    </div>
  )
}
