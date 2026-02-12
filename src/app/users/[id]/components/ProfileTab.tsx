'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { User, Loader2 } from 'lucide-react'

interface ProfileTabProps {
  clientId: string
}

interface ClientProfile {
  full_name: string | null
  email: string
  profile_picture_url: string | null
  created_at: string
}

export default function ProfileTab({ clientId }: ProfileTabProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ClientProfile | null>(null)

  useEffect(() => {
    fetchData()
  }, [clientId])

  async function fetchData() {
    setLoading(true)
    
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, email, profile_picture_url, created_at')
      .eq('id', clientId)
      .single()
    
    if (profileData) setProfile(profileData)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Profile Picture */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Profile Picture</h3>
        </div>
        
        <div className="flex items-center gap-6">
          {profile?.profile_picture_url ? (
            <img
              src={profile.profile_picture_url}
              alt={profile.full_name || 'Client'}
              className="w-32 h-32 rounded-2xl object-cover"
            />
          ) : (
            <div className="w-32 h-32 rounded-2xl bg-zinc-800 flex items-center justify-center">
              <User className="w-12 h-12 text-zinc-600" />
            </div>
          )}
          <div>
            <p className="text-zinc-400 text-sm">
              {profile?.profile_picture_url 
                ? 'Profile picture uploaded by client'
                : 'No profile picture uploaded yet'
              }
            </p>
            <p className="text-zinc-500 text-xs mt-1">
              Clients can update their profile picture in the app
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
