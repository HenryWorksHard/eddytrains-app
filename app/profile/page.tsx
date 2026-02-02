'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'
import BottomNav from '../components/BottomNav'

interface Profile {
  id: string
  full_name: string | null
  email: string
  role: string | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile({
        id: user.id,
        full_name: data?.full_name || null,
        email: user.email || '',
        role: data?.role || null,
      })
      setLoading(false)
    }

    loadProfile()
  }, [supabase, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header - Industrial Minimal */}
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="px-6 py-8 text-center">
          <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
            👤
          </div>
          <h1 className="text-xl font-bold text-white">
            {profile?.full_name || 'User'}
          </h1>
          <p className="text-zinc-500 mt-1">{profile?.email}</p>
          <div className="w-12 h-1 bg-yellow-400 mx-auto mt-4"></div>
        </div>
      </header>

      <main className="px-6 py-6 space-y-4">
        {/* Account Section */}
        <section>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Account</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-4 border-b border-zinc-800">
              <p className="text-zinc-500 text-sm">Email</p>
              <p className="text-white mt-1">{profile?.email}</p>
            </div>
            <div className="px-4 py-4">
              <p className="text-zinc-500 text-sm">Member since</p>
              <p className="text-white mt-1">2025</p>
            </div>
          </div>
        </section>

        {/* Admin Section (only for admins) */}
        {profile?.role === 'admin' && (
          <section>
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Admin</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <a 
                href="/admin"
                className="flex items-center justify-between px-4 py-4 hover:bg-zinc-800/50 transition-colors"
              >
                <span className="text-white">👑 Admin Dashboard</span>
                <span className="text-yellow-400">→</span>
              </a>
            </div>
          </section>
        )}

        {/* Settings Section */}
        <section>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Settings</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <a 
              href="/reset-password"
              className="flex items-center justify-between px-4 py-4 hover:bg-zinc-800/50 transition-colors"
            >
              <span className="text-white">Change Password</span>
              <span className="text-zinc-600">→</span>
            </a>
          </div>
        </section>

        {/* Support Section */}
        <section>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Support</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <a 
              href="mailto:support@compound.com"
              className="flex items-center justify-between px-4 py-4 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
            >
              <span className="text-white">Contact Support</span>
              <span className="text-zinc-600">→</span>
            </a>
            <a 
              href="https://instagram.com/compound"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-4 hover:bg-zinc-800/50 transition-colors"
            >
              <span className="text-white">Follow on Instagram</span>
              <span className="text-zinc-600">→</span>
            </a>
          </div>
        </section>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-red-500 font-medium rounded-2xl transition-colors mt-6"
        >
          Sign Out
        </button>

        <p className="text-center text-zinc-600 text-xs mt-8">
          CMPD v1.0.0
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
