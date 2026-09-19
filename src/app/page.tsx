import { getVerifiedUser } from '@/app/lib/auth-claims'
import { redirect } from 'next/navigation'
import { createClient } from './lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const user = await getVerifiedUser(supabase)

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
