'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase/client'
import Link from 'next/link'

interface OneRM {
  id?: string
  exercise_name: string
  weight_kg: number
}

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

interface Props {
  initialOneRMs: OneRM[]
}

export default function OneRMClient({ initialOneRMs }: Props) {
  // Merge with common lifts
  const existingMap = new Map(initialOneRMs.map(rm => [rm.exercise_name, rm]))
  const merged = COMMON_LIFTS.map(name => 
    existingMap.get(name) || { exercise_name: name, weight_kg: 0 }
  )
  // Add any custom lifts not in COMMON_LIFTS
  initialOneRMs.forEach(rm => {
    if (!COMMON_LIFTS.includes(rm.exercise_name)) {
      merged.push(rm)
    }
  })

  const [oneRMs, setOneRMs] = useState<OneRM[]>(merged)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const updateValue = (exerciseName: string, value: number) => {
    setOneRMs(prev => prev.map(rm => 
      rm.exercise_name === exerciseName ? { ...rm, weight_kg: value } : rm
    ))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Save non-zero values
      const toSave = oneRMs.filter(rm => rm.weight_kg > 0)
      
      for (const rm of toSave) {
        await supabase
          .from('client_1rms')
          .upsert({
            client_id: user.id,
            exercise_name: rm.exercise_name,
            weight_kg: rm.weight_kg,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'client_id,exercise_name'
          })
      }

      // Delete zeroed ones that had values before
      const toDelete = oneRMs.filter(rm => rm.weight_kg === 0 && rm.id)
      for (const rm of toDelete) {
        await supabase
          .from('client_1rms')
          .delete()
          .eq('id', rm.id)
      }

      setEditing(false)
    } catch (err) {
      console.error('Failed to save:', err)
      alert('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 bg-black/95 backdrop-blur-lg border-b border-zinc-800 z-40">
        <div className="px-6 py-4">
          <Link href="/dashboard" className="text-yellow-400 text-sm font-medium mb-2 inline-block">
            ← Back
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">1RM Tracking</h1>
              <p className="text-zinc-500 text-sm mt-1">Your one-rep maxes</p>
            </div>
            {editing ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black font-medium rounded-xl transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="px-6 py-6">
        <p className="text-zinc-400 text-sm mb-6">
          Track your one-rep maxes to auto-calculate weights when programs use percentage-based intensity.
        </p>

        <div className="space-y-3">
          {oneRMs.map((rm) => (
            <div
              key={rm.exercise_name}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                rm.weight_kg > 0 
                  ? 'bg-zinc-900 border-zinc-800' 
                  : 'bg-zinc-900/50 border-zinc-800/50'
              }`}
            >
              <div>
                <p className={`font-medium ${rm.weight_kg > 0 ? 'text-white' : 'text-zinc-500'}`}>
                  {rm.exercise_name}
                </p>
              </div>
              
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={rm.weight_kg || ''}
                    onChange={(e) => updateValue(rm.exercise_name, parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-20 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-right font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                  <span className="text-zinc-400">kg</span>
                </div>
              ) : (
                <p className={`text-xl font-bold ${rm.weight_kg > 0 ? 'text-yellow-400' : 'text-zinc-600'}`}>
                  {rm.weight_kg > 0 ? `${rm.weight_kg} kg` : '—'}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-yellow-400/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium text-sm">How it works</p>
              <p className="text-zinc-400 text-xs mt-1">
                When your program says "75% intensity", we'll calculate the exact weight based on your 1RM. 
                For example, 75% of a 100kg squat = 75kg.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
