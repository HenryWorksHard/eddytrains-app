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

interface Client1RM {
  id?: string
  exercise_name: string
  weight_kg: number
}

// Common compound lifts for 1RM tracking
const COMMON_LIFTS = [
  'Squat',
  'Bench Press',
  'Deadlift',
  'Overhead Press',
  'Barbell Row',
  'Front Squat',
  'Romanian Deadlift',
  'Incline Bench Press'
]

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [client1RMs, setClient1RMs] = useState<Client1RM[]>([])
  const [editing1RM, setEditing1RM] = useState(false)
  const [saving1RM, setSaving1RM] = useState(false)
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
      
      // Load 1RMs
      await load1RMs(user.id)
      
      setLoading(false)
    }

    loadProfile()
  }, [supabase, router])

  const load1RMs = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_1rms')
        .select('id, exercise_name, weight_kg')
        .eq('client_id', userId)
      
      if (error) {
        console.error('Failed to fetch 1RMs:', error)
        setClient1RMs(COMMON_LIFTS.map(name => ({ exercise_name: name, weight_kg: 0 })))
        return
      }
      
      // Merge with common lifts
      const existingMap = new Map((data || []).map(rm => [rm.exercise_name, rm]))
      const merged = COMMON_LIFTS.map(name => 
        existingMap.get(name) || { exercise_name: name, weight_kg: 0 }
      )
      setClient1RMs(merged)
    } catch (err) {
      console.error('Failed to fetch 1RMs:', err)
      setClient1RMs(COMMON_LIFTS.map(name => ({ exercise_name: name, weight_kg: 0 })))
    }
  }

  const save1RMs = async () => {
    if (!profile) return
    setSaving1RM(true)
    
    try {
      const toSave = client1RMs.filter(rm => rm.weight_kg > 0)
      
      for (const rm of toSave) {
        const { error } = await supabase
          .from('client_1rms')
          .upsert({
            client_id: profile.id,
            exercise_name: rm.exercise_name,
            weight_kg: rm.weight_kg,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'client_id,exercise_name'
          })
        
        if (error) throw error
      }
      
      setEditing1RM(false)
      await load1RMs(profile.id)
    } catch (err) {
      console.error('Failed to save 1RMs:', err)
      alert('Failed to save. Please try again.')
    } finally {
      setSaving1RM(false)
    }
  }

  const update1RM = (exerciseName: string, weightKg: number) => {
    setClient1RMs(prev => prev.map(rm => 
      rm.exercise_name === exerciseName ? { ...rm, weight_kg: weightKg } : rm
    ))
  }

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

        {/* 1RM Board Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">1RM Board</h2>
            {editing1RM ? (
              <div className="flex gap-2">
                <button
                  onClick={save1RMs}
                  disabled={saving1RM}
                  className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving1RM ? '...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditing1RM(false)
                    if (profile) load1RMs(profile.id)
                  }}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing1RM(true)}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors"
              >
                Edit
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Enter your one-rep maxes for percentage-based weight calculations
          </p>
          <div className="grid grid-cols-2 gap-3">
            {client1RMs.map((rm) => (
              <div
                key={rm.exercise_name}
                className={`p-4 rounded-xl border ${
                  rm.weight_kg > 0 
                    ? 'bg-zinc-900 border-zinc-700' 
                    : 'bg-zinc-900/50 border-zinc-800'
                }`}
              >
                <p className="text-xs text-zinc-400 mb-2 truncate">{rm.exercise_name}</p>
                {editing1RM ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={rm.weight_kg || ''}
                      onChange={(e) => update1RM(rm.exercise_name, parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-lg font-bold focus:outline-none focus:ring-1 focus:ring-yellow-400"
                    />
                    <span className="text-zinc-500 text-sm">kg</span>
                  </div>
                ) : (
                  <p className={`text-xl font-bold ${rm.weight_kg > 0 ? 'text-white' : 'text-zinc-600'}`}>
                    {rm.weight_kg > 0 ? `${rm.weight_kg}kg` : '—'}
                  </p>
                )}
              </div>
            ))}
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
