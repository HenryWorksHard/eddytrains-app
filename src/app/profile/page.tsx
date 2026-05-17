'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'
import { compressImage } from '../lib/imageUtils'
import { useTheme } from '../lib/ThemeContext'
import BottomNav from '../components/BottomNav'
import { SlideOutMenu, HamburgerButton } from '../components/SlideOutMenu'
import Image from 'next/image'
import { Sun, Moon, Sparkles } from 'lucide-react'
import AppLoading from '@/components/AppLoading'
import Pascal, {
  type PascalColorTheme,
  type PascalSkinTone,
  type PascalOutfit,
  type PascalCharacter,
  PASCAL_COLOR_KEYS,
  PASCAL_SKIN_KEYS,
  PASCAL_OUTFIT_KEYS,
  PASCAL_CHARACTER_KEYS,
  getPascalSwatch,
  getPascalSkinSwatch,
} from '@/components/Pascal'

// NB: Progress pictures live on the dedicated /progress-pictures page.
// The profile page used to duplicate that section; removed to avoid drift.

interface Profile {
  id: string
  full_name: string | null
  email: string
  role: string | null
  profile_picture_url: string | null
  goals: string | null
  presenting_condition: string | null
  medical_history: string | null
  pascal_name: string | null
  pascal_color: PascalColorTheme | null
  pascal_skin: PascalSkinTone | null
  pascal_outfit: PascalOutfit | null
  pascal_character: PascalCharacter | null
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing1RM, setEditing1RM] = useState(false)
  const [saving1RM, setSaving1RM] = useState(false)
  const [uploadingPfp, setUploadingPfp] = useState(false)
  
  // Client info
  const [editingInfo, setEditingInfo] = useState(false)
  const [savingInfo, setSavingInfo] = useState(false)
  const [goals, setGoals] = useState('')
  const [presentingCondition, setPresentingCondition] = useState('')
  const [medicalHistory, setMedicalHistory] = useState('')
  // Account deletion state — Apple Guideline 5.1.1(v) requires in-app deletion.
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // Pascal customizer state
  const [pascalName, setPascalName] = useState('')
  const [pascalColor, setPascalColor] = useState<PascalColorTheme>('yellow')
  const [pascalSkin, setPascalSkin] = useState<PascalSkinTone>('tan')
  const [pascalOutfit, setPascalOutfit] = useState<PascalOutfit>('none')
  const [pascalCharacter, setPascalCharacter] = useState<PascalCharacter>('classic')
  const [pascalSavedAt, setPascalSavedAt] = useState<number | null>(null)
  const pascalSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pfpInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()
  const { theme, toggleTheme } = useTheme()

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

      const initialPascalColor = (data?.pascal_color && PASCAL_COLOR_KEYS.includes(data.pascal_color as PascalColorTheme))
        ? (data.pascal_color as PascalColorTheme)
        : null
      const initialPascalSkin = (data?.pascal_skin && PASCAL_SKIN_KEYS.includes(data.pascal_skin as PascalSkinTone))
        ? (data.pascal_skin as PascalSkinTone)
        : null
      const initialPascalOutfit = (data?.pascal_outfit && PASCAL_OUTFIT_KEYS.includes(data.pascal_outfit as PascalOutfit))
        ? (data.pascal_outfit as PascalOutfit)
        : null
      const initialPascalCharacter = (data?.pascal_character && PASCAL_CHARACTER_KEYS.includes(data.pascal_character as PascalCharacter))
        ? (data.pascal_character as PascalCharacter)
        : null
      setProfile({
        id: user.id,
        full_name: data?.full_name || null,
        email: user.email || '',
        role: data?.role || null,
        profile_picture_url: data?.profile_picture_url || null,
        goals: data?.goals || null,
        presenting_condition: data?.presenting_condition || null,
        medical_history: data?.medical_history || null,
        pascal_name: data?.pascal_name || null,
        pascal_color: initialPascalColor,
        pascal_skin: initialPascalSkin,
        pascal_outfit: initialPascalOutfit,
        pascal_character: initialPascalCharacter,
      })
      setPascalName(data?.pascal_name || '')
      setPascalColor(initialPascalColor || 'yellow')
      setPascalSkin(initialPascalSkin || 'tan')
      setPascalOutfit(initialPascalOutfit || 'none')
      setPascalCharacter(initialPascalCharacter || 'classic')
      
      // Set client info state
      setGoals(data?.goals || '')
      setPresentingCondition(data?.presenting_condition || '')
      setMedicalHistory(data?.medical_history || '')
      
      // Load 1RMs
      await load1RMs(user.id)

      setLoading(false)
    }

    loadProfile()
  }, [supabase, router])

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
      
      // Use upsert for clean insert-or-update in one query
      // Requires unique constraint on (client_id, exercise_name)
      for (const rm of toSave) {
        const { error } = await supabase
          .from('client_1rms')
          .upsert({
            client_id: user.id,
            exercise_name: rm.exercise_name,
            weight_kg: rm.weight_kg,
            updated_at: new Date().toISOString()
          }, { 
            onConflict: 'client_id,exercise_name' 
          })
        
        if (error) {
          console.error('Upsert error:', error)
          throw error
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

  const saveClientInfo = async () => {
    if (!profile) return
    setSavingInfo(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          goals: goals || null,
          presenting_condition: presentingCondition || null,
          medical_history: medicalHistory || null
        })
        .eq('id', profile.id)

      if (error) throw error

      // Update local profile state
      setProfile(prev => prev ? {
        ...prev,
        goals: goals || null,
        presenting_condition: presentingCondition || null,
        medical_history: medicalHistory || null
      } : null)
      
      setEditingInfo(false)
    } catch (err) {
      console.error('Failed to save info:', err)
      alert('Failed to save. Please try again.')
    } finally {
      setSavingInfo(false)
    }
  }

  // Debounce-save Pascal customization. Optimistic UI — preview updates
  // instantly via local state; queueSave persists all five dimensions.
  const savePascalCustomization = async (next: {
    name: string
    color: PascalColorTheme
    skin: PascalSkinTone
    outfit: PascalOutfit
    character: PascalCharacter
  }) => {
    if (!profile) return
    const trimmed = next.name.trim().slice(0, 20)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase
        .from('profiles')
        .update({
          pascal_name: trimmed || null,
          pascal_color: next.color,
          pascal_skin: next.skin,
          pascal_outfit: next.outfit,
          pascal_character: next.character,
        })
        .eq('id', user.id)
      if (error) throw error
      setProfile((prev) => prev ? {
        ...prev,
        pascal_name: trimmed || null,
        pascal_color: next.color,
        pascal_skin: next.skin,
        pascal_outfit: next.outfit,
        pascal_character: next.character,
      } : prev)
      setPascalSavedAt(Date.now())
      setTimeout(() => setPascalSavedAt(null), 2000)
    } catch (e) {
      console.error('[pascal-customize] save failed:', e)
    }
  }

  const queueSave = (next: {
    name?: string
    color?: PascalColorTheme
    skin?: PascalSkinTone
    outfit?: PascalOutfit
    character?: PascalCharacter
  }, immediate = false) => {
    const payload = {
      name: next.name ?? pascalName,
      color: next.color ?? pascalColor,
      skin: next.skin ?? pascalSkin,
      outfit: next.outfit ?? pascalOutfit,
      character: next.character ?? pascalCharacter,
    }
    if (pascalSaveTimeoutRef.current) clearTimeout(pascalSaveTimeoutRef.current)
    if (immediate) {
      savePascalCustomization(payload)
    } else {
      pascalSaveTimeoutRef.current = setTimeout(() => savePascalCustomization(payload), 500)
    }
  }

  const onPascalNameChange = (next: string) => {
    setPascalName(next)
    queueSave({ name: next })
  }
  const onPascalColorChange = (next: PascalColorTheme) => {
    setPascalColor(next)
    queueSave({ color: next }, true)
  }
  const onPascalSkinChange = (next: PascalSkinTone) => {
    setPascalSkin(next)
    queueSave({ skin: next }, true)
  }
  const onPascalOutfitChange = (next: PascalOutfit) => {
    setPascalOutfit(next)
    queueSave({ outfit: next }, true)
  }
  const onPascalCharacterChange = (next: PascalCharacter) => {
    setPascalCharacter(next)
    queueSave({ character: next }, true)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/auth/delete-account', { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to delete account')
      }
      // Sign the client out and bounce to the login screen.
      await supabase.auth.signOut()
      router.replace('/login?deleted=1')
      router.refresh()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete account')
      setDeleting(false)
    }
  }

  if (loading) {
    return <AppLoading />
  }

  return (
    <div className="min-h-screen bg-black pb-nav">
      {/* Slide Out Menu */}
      <SlideOutMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      
      {/* Header - Industrial Minimal */}
      <header className="bg-black border-b border-zinc-800">
        {/* Hamburger Row */}
        <div className="flex items-center justify-between px-4 pt-3">
          <HamburgerButton onClick={() => setMenuOpen(true)} />
          <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Profile</span>
          <div className="w-10" /> {/* Spacer for balance */}
        </div>
        
        <div className="px-6 py-6 text-center">
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

        {/* My Info Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">My Info</h2>
            {editingInfo ? (
              <div className="flex gap-2">
                <button
                  onClick={saveClientInfo}
                  disabled={savingInfo}
                  className="px-3 py-1 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingInfo ? '...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingInfo(false)
                    setGoals(profile?.goals || '')
                    setPresentingCondition(profile?.presenting_condition || '')
                    setMedicalHistory(profile?.medical_history || '')
                  }}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingInfo(true)}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors"
              >
                Edit
              </button>
            )}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {/* Goals */}
            <div className="px-4 py-4 border-b border-zinc-800">
              <p className="text-zinc-500 text-sm mb-2">Goals</p>
              {editingInfo ? (
                <textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="What are your fitness goals?"
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none text-sm"
                />
              ) : (
                <p className="text-white text-sm">
                  {profile?.goals || <span className="text-zinc-600">Not set</span>}
                </p>
              )}
            </div>
            {/* Presenting Condition */}
            <div className="px-4 py-4 border-b border-zinc-800">
              <p className="text-zinc-500 text-sm mb-2">Presenting Condition</p>
              {editingInfo ? (
                <textarea
                  value={presentingCondition}
                  onChange={(e) => setPresentingCondition(e.target.value)}
                  placeholder="Current physical condition, injuries, limitations..."
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none text-sm"
                />
              ) : (
                <p className="text-white text-sm">
                  {profile?.presenting_condition || <span className="text-zinc-600">Not set</span>}
                </p>
              )}
            </div>
            {/* Medical History */}
            <div className="px-4 py-4">
              <p className="text-zinc-500 text-sm mb-2">Medical History</p>
              {editingInfo ? (
                <textarea
                  value={medicalHistory}
                  onChange={(e) => setMedicalHistory(e.target.value)}
                  placeholder="Relevant medical history, surgeries, conditions..."
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none text-sm"
                />
              ) : (
                <p className="text-white text-sm">
                  {profile?.medical_history || <span className="text-zinc-600">Not set</span>}
                </p>
              )}
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
                    ? 'bg-theme-card border-zinc-700' 
                    : 'bg-theme-surface border-zinc-800'
                }`}
              >
                <p className="text-xs text-theme-muted mb-2 truncate">{rm.exercise_name}</p>
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
                  <p className={`text-xl font-bold ${rm.weight_kg > 0 ? 'text-theme-primary' : 'text-zinc-600'}`}>
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

        {/* Pascal Customizer */}
        <section>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            Customize your buddy
          </h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5">
            {/* Live preview */}
            <div className="flex items-center justify-center py-2">
              <Pascal
                score={110}
                size={140}
                colorTheme={pascalColor}
                skinTone={pascalSkin}
                outfit={pascalOutfit}
                character={pascalCharacter}
              />
            </div>

            {/* Name input */}
            <div>
              <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Name</label>
              <input
                type="text"
                value={pascalName}
                onChange={(e) => onPascalNameChange(e.target.value)}
                placeholder="Pascal"
                maxLength={20}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <p className="text-[11px] text-zinc-600 mt-1">{pascalName.length}/20 — leave blank for &quot;Pascal&quot;</p>
            </div>

            {/* Character picker */}
            <div>
              <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Character</label>
              <div className="grid grid-cols-2 gap-2">
                {PASCAL_CHARACTER_KEYS.map((key) => {
                  const selected = pascalCharacter === key
                  const label = key === 'classic' ? 'Classic' : 'Robot'
                  return (
                    <button
                      key={key}
                      onClick={() => onPascalCharacterChange(key)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                        selected ? 'border-yellow-400 bg-zinc-800' : 'border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      <Pascal score={120} size={60} colorTheme={pascalColor} skinTone={pascalSkin} outfit="none" character={key} />
                      <span className={`text-xs font-medium ${selected ? 'text-yellow-400' : 'text-zinc-400'}`}>{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Skin tone swatches */}
            <div>
              <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Skin tone</label>
              <div className="flex flex-wrap gap-2">
                {PASCAL_SKIN_KEYS.map((key) => {
                  const selected = pascalSkin === key
                  return (
                    <button
                      key={key}
                      onClick={() => onPascalSkinChange(key)}
                      aria-label={`Skin tone: ${key}`}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        selected ? 'border-white scale-110' : 'border-zinc-700 hover:border-zinc-500'
                      }`}
                      style={{ backgroundColor: getPascalSkinSwatch(key) }}
                    />
                  )
                })}
              </div>
            </div>

            {/* Accent colour swatches */}
            <div>
              <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Accent colour</label>
              <div className="flex flex-wrap gap-2">
                {PASCAL_COLOR_KEYS.map((key) => {
                  const selected = pascalColor === key
                  return (
                    <button
                      key={key}
                      onClick={() => onPascalColorChange(key)}
                      aria-label={`Accent colour: ${key}`}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        selected ? 'border-white scale-110' : 'border-zinc-700 hover:border-zinc-500'
                      }`}
                      style={{ backgroundColor: getPascalSwatch(key) }}
                    />
                  )
                })}
              </div>
              <p className="text-[11px] text-zinc-600 mt-1">Shows on outfits, sparkles, robot visor.</p>
            </div>

            {/* Outfit picker */}
            <div>
              <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Outfit</label>
              <div className="flex flex-wrap gap-2">
                {PASCAL_OUTFIT_KEYS.map((key) => {
                  const selected = pascalOutfit === key
                  const label =
                    key === 'none' ? 'None'
                    : key === 'cap' ? 'Cap'
                    : key === 'headband' ? 'Headband'
                    : key === 'sunglasses' ? 'Shades'
                    : 'Beanie'
                  return (
                    <button
                      key={key}
                      onClick={() => onPascalOutfitChange(key)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        selected ? 'bg-yellow-400 text-black' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {pascalSavedAt && (
              <p className="text-xs text-green-400">Saved</p>
            )}
          </div>
        </section>

        {/* Settings Section */}
        <section>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Settings</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <Moon className="w-5 h-5 text-zinc-400" />
                ) : (
                  <Sun className="w-5 h-5 text-yellow-400" />
                )}
                <span className="text-white">Theme</span>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  theme === 'light' ? 'bg-yellow-400' : 'bg-zinc-700'
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    theme === 'light' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
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
              href="mailto:contact@cmpdcollective.com"
              className="flex items-center justify-between px-4 py-4 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
            >
              <span className="text-white">Contact Support</span>
              <span className="text-zinc-600">→</span>
            </a>
            <a 
              href="https://www.instagram.com/eddytrains/"
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

        {/* Danger zone — self-service account deletion (Apple 5.1.1(v)) */}
        <section className="mt-8 pt-6 border-t border-zinc-900">
          <h2 className="text-xs uppercase tracking-wider text-zinc-600 mb-2">Danger zone</h2>
          <p className="text-sm text-zinc-500 mb-3">
            Permanently delete your account and all associated data — workouts, progress photos, goals, history. This cannot be undone.
          </p>
          <button
            onClick={() => {
              setDeleteConfirmText('')
              setDeleteError(null)
              setShowDeleteModal(true)
            }}
            className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-medium rounded-xl transition-colors"
          >
            Delete my account
          </button>
        </section>

        <p className="text-center text-zinc-600 text-xs mt-8">
          CMPD v1.0.0
        </p>
      </main>

      {/* Delete-account confirmation modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="bg-zinc-900 border-t sm:border border-zinc-700 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[calc(100dvh-env(safe-area-inset-top)-1rem)] overflow-hidden pb-[env(safe-area-inset-bottom)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2.5 pb-1 shrink-0 sm:hidden">
              <div className="w-10 h-1 bg-zinc-700 rounded-full" />
            </div>
            <div className="p-5 border-b border-zinc-800">
              <h3 className="text-lg font-semibold text-white">Delete your account?</h3>
              <p className="text-sm text-zinc-400 mt-1">
                This is permanent. We&apos;ll erase your workouts, progress photos, goals, history, and your sign-in. There&apos;s no recovery.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-xs uppercase tracking-wider text-zinc-500">
                Type DELETE to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                autoCapitalize="characters"
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {deleteError && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  {deleteError}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-zinc-800 flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText.trim() !== 'DELETE'}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:bg-red-500/30 disabled:text-red-300/50 text-white font-bold rounded-xl transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
