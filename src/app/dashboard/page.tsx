import { createClient } from '@/app/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClientDashboard from './ClientDashboard'
import AdminDashboard from './AdminDashboard'

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic'

async function getUserRole() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  
  return profile?.role || 'client'
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>
}) {
  const role = await getUserRole()
  
  if (!role) {
    redirect('/login')
  }
  
  const params = await searchParams
  const adminRoles = ['super_admin', 'company_admin', 'admin', 'trainer']
  
  if (adminRoles.includes(role)) {
    return <AdminDashboard searchParams={params} />
  }
  
  return <ClientDashboard />
}
