'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import AppLoading from '@/components/AppLoading'

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
    return <AppLoading />
  }

  if (!isSuperAdmin) return null

  // Note: Sidebar renders its own mobile-header spacer + the desktop
  // sidebar at lg:ml-64. Don't add a top padding to <main> on mobile —
  // that would double-stack with the spacer. Don't use `flex` here
  // either; the desktop sidebar is fixed-positioned, not a flex sibling.
  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="p-4 lg:p-8 lg:ml-64">
        {children}
      </main>
    </div>
  )
}
