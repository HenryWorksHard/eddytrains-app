'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'
import { compressImage } from '../lib/imageUtils'
import BottomNav from '../components/BottomNav'
import Image from 'next/image'

interface Profile {
  id: string
  full_name: string | null
  email: string
  role: string | null
  profile_picture_url: string | null
}

interface Client1RM {
  id?: string
  exercise_name: string
  weight_kg: number
}

interface ProgressImage {
  id: string
  image_url: string
  created_at: string
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
  const [progressImages, setProgressImages] = useState<ProgressImage[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [selectedImage, setSelectedImage] = useState<ProgressImage | null>(null)
  const [uploadingPfp, setUploadingPfp] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pfpInputRef = useRef<HTMLInputElement>(null)
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
        profile_picture_url: data?.profile_picture_url || null,
      })
      
      // Load 1RMs
      await load1RMs(user.id)
      
      // Load progress images
      await loadProgressImages(user.id)
      
      setLoading(false)
    }

    loadProfile()
  }, [supabase, router])

  const loadProgressImages = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('progress_images')
        .select('*')
        .eq('client_id', userId)
        .order('created_at', { ascending: false })
        .limit(8)
      
      if (!error && data) {
        setProgressImages(data)
      }
    } catch (err) {
      console.error('Failed to load progress images:', err)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setUploadingImage(true)
    try {
      const compressedBlob = await compressImage(file, 1200, 0.8)
      const fileName = `${profile.id}/${Date.now()}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('progress-images')
        .upload(fileName, compressedBlob, { contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('progress-images')
        .getPublicUrl(fileName)

      const { data: newImage, error: insertError } = await supabase
        .from('progress_images')
        .insert({ client_id: profile.id, image_url: publicUrl })
        .select()
        .single()

      if (insertError) throw insertError

      setProgressImages(prev => [newImage, ...prev].slice(0, 8))
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Failed to upload. Please try again.')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  }

  const handleDeleteProgressImage = async (imageId: string, imageUrl: string) => {
    if (!confirm('Delete this progress photo?')) return
    
    try {
      const urlParts = imageUrl.split('/progress-images/')
      if (urlParts[1]) {
        await supabase.storage.from('progress-images').remove([urlParts[1]])
      }
      
      await supabase.from('progress_images').delete().eq('id', imageId)
      setProgressImages(prev => prev.filter(img => img.id !== imageId))
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const handlePfpUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setUploadingPfp(true)
    try {
      const compressedBlob = await compressImage(file, 400, 0.85)
      const fileName = `${profile.id}/avatar.jpg`

      // Delete old one first if exists
      await supabase.storage.from('profile-pictures').remove([fileName])

      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, compressedBlob, { contentType: 'image/jpeg', upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName)

      // Add cache buster
      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_picture_url: urlWithCacheBuster })
        .eq('id', profile.id)

      if (updateError) throw updateError

      setProfile(prev => prev ? { ...prev, profile_picture_url: urlWithCacheBuster } : null)
    } catch (err) {
      console.error('PFP upload failed:', err)
      alert('Failed to upload. Please try again.')
    } finally {
      setUploadingPfp(false)
      if (pfpInputRef.current) pfpInputRef.current.value = ''
    }
  }

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
      // Get the authenticated user's ID directly
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please log in again')
        return
      }
      
      const toSave = client1RMs.filter(rm => rm.weight_kg > 0)
      
      for (const rm of toSave) {
        // First try to update existing
        const { data: existing } = await supabase
          .from('client_1rms')
          .select('id')
          .eq('client_id', user.id)
          .eq('exercise_name', rm.exercise_name)
          .single()
        
        if (existing) {
          // Update
          const { error } = await supabase
            .from('client_1rms')
            .update({ weight_kg: rm.weight_kg, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
          if (error) {
            console.error('Update error:', error)
            throw error
          }
        } else {
          // Insert
          const { error } = await supabase
            .from('client_1rms')
            .insert({
              client_id: user.id,
              exercise_name: rm.exercise_name,
              weight_kg: rm.weight_kg
            })
          if (error) {
            console.error('Insert error:', error)
            throw error
          }
        }
      }
      
      setEditing1RM(false)
      await load1RMs(user.id)
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
          <input
            ref={pfpInputRef}
            type="file"
            accept="image/*"
            onChange={handlePfpUpload}
            className="hidden"
          />
          <button
            onClick={() => pfpInputRef.current?.click()}
            disabled={uploadingPfp}
            className="relative w-24 h-24 mx-auto mb-4 group"
          >
            {profile?.profile_picture_url ? (
              <Image
                src={profile.profile_picture_url}
                alt="Profile"
                fill
                className="rounded-full object-cover"
                sizes="96px"
              />
            ) : (
              <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center text-4xl">
                👤
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingPfp ? (
                <svg className="w-6 h-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </div>
          </button>
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

        {/* Progress Pictures Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Progress Pictures</h2>
            <a href="/progress-pictures" className="text-yellow-400 text-sm">View all</a>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 border border-zinc-700 rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-colors mb-3"
            >
              {uploadingImage ? (
                <>
                  <svg className="w-5 h-5 animate-spin text-yellow-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-zinc-400">Uploading...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-white font-medium">Add Photo</span>
                </>
              )}
            </button>
            
            {progressImages.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {progressImages.map((img) => (
                  <div key={img.id} className="aspect-square relative rounded-lg overflow-hidden bg-zinc-800 group">
                    <button
                      onClick={() => setSelectedImage(img)}
                      className="absolute inset-0 hover:ring-2 hover:ring-yellow-400 transition-all"
                    >
                      <Image
                        src={img.image_url}
                        alt="Progress"
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteProgressImage(img.id, img.image_url); }}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-sm text-center py-4">No progress photos yet</p>
            )}
          </div>
        </section>

        {/* Image Modal */}
        {selectedImage && (
          <div 
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900">
                <Image
                  src={selectedImage.image_url}
                  alt="Progress"
                  fill
                  className="object-contain"
                  sizes="500px"
                />
              </div>
              <p className="text-white font-medium text-center mt-4">{formatDate(selectedImage.created_at)}</p>
            </div>
          </div>
        )}

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
