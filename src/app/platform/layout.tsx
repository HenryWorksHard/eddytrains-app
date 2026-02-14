'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'super_admin') {
        router.push('/dashboard')
        return
      }

      setIsSuperAdmin(true)
      setLoading(false)
    }

    checkAccess()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="flex min-h-screen bg-zinc-950">
        <Sidebar />
        <main className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8 lg:ml-64">
          <div className="animate-pulse">
            <div className="h-8 w-64 bg-zinc-800 rounded mb-4"></div>
            <div className="h-4 w-48 bg-zinc-800 rounded"></div>
          </div>
        </main>
      </div>
    )
  }

  if (!isSuperAdmin) return null

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8 lg:ml-64">
        {children}
      </main>
    </div>
  )
}
