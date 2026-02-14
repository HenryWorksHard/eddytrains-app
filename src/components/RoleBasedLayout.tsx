'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import Sidebar from './Sidebar'

interface RoleBasedLayoutProps {
  children: React.ReactNode
}

export default function RoleBasedLayout({ children }: RoleBasedLayoutProps) {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function getRole() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        
        setRole(profile?.role || 'client')
      }
      setLoading(false)
    }
    
    getRole()
  }, [])
  
  // Admin/Trainer roles that get the sidebar
  const adminRoles = ['super_admin', 'company_admin', 'admin', 'trainer']
  const isAdmin = role && adminRoles.includes(role)
  
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  
  // Admin/Trainer view - Sidebar + desktop layout
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Sidebar />
        <main className="lg:ml-64 p-4 lg:p-8 pt-20 lg:pt-8">
          {children}
        </main>
      </div>
    )
  }
  
  // Client view - just render children (pages handle their own layout)
  return <>{children}</>
}
