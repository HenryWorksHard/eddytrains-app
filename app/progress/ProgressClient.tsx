'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase/client'
import Image from 'next/image'
import Link from 'next/link'
import { TrendingUp, Flame, Weight, Camera, Dumbbell, ChevronRight } from 'lucide-react'

interface OneRM {
  exercise_name: string
  weight_kg: number
  updated_at: string
}

interface ProgressImage {
  id: string
  image_url: string
  created_at: string
}

interface ProgressClientProps {
  oneRMs: OneRM[]
  progressImages: ProgressImage[]
  weeklyTonnage: number
  exerciseNames: string[]
  clientId: string
}

export default function ProgressClient({ 
  oneRMs, 
  progressImages, 
  weeklyTonnage, 
  exerciseNames,
  clientId 
}: ProgressClientProps) {
  const [streak, setStreak] = useState({ current: 0, longest: 0 })
  const [selectedImage, setSelectedImage] = useState<ProgressImage | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchStreak()
  }, [])

  const fetchStreak = async () => {
    try {
      const response = await fetch('/api/workouts/streak')
      if (response.ok) {
        const data = await response.json()
        setStreak({ 
          current: data.streak || 0, 
          longest: data.longestStreak || data.streak || 0 
        })
      }
    } catch (err) {
      console.error('Failed to fetch streak:', err)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    })
  }

  const formatTonnage = (kg: number) => {
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(1)}t`
    }
    return `${Math.round(kg)}kg`
  }

  return (
    <main className="px-4 py-4 space-y-6">
      {/* Stats Overview */}
      <section className="grid grid-cols-3 gap-3">
        {/* Current Streak */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <Flame className="w-5 h-5 text-orange-400" />
          </div>
          <p className="text-2xl font-bold text-white">{streak.current}</p>
          <p className="text-xs text-zinc-500">Day Streak</p>
        </div>

        {/* Weekly Tonnage */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <Weight className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{formatTonnage(weeklyTonnage)}</p>
          <p className="text-xs text-zinc-500">This Week</p>
        </div>

        {/* Workouts Count or Longest Streak */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white">{streak.longest}</p>
          <p className="text-xs text-zinc-500">Best Streak</p>
        </div>
      </section>

      {/* 1RM Records */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Personal Records</h2>
          <Link href="/profile" className="text-yellow-400 text-xs">Edit</Link>
        </div>
        
        {oneRMs.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {oneRMs.slice(0, 6).map((rm) => (
              <div 
                key={rm.exercise_name}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-3"
              >
                <p className="text-xs text-zinc-500 truncate mb-1">{rm.exercise_name}</p>
                <p className="text-lg font-bold text-white">{rm.weight_kg}kg</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <Dumbbell className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">No PRs recorded yet</p>
            <Link href="/profile" className="text-yellow-400 text-sm mt-2 inline-block">
              Add your 1RMs →
            </Link>
          </div>
        )}
      </section>

      {/* Progress Photos */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Progress Photos</h2>
          <Link href="/progress-pictures" className="text-yellow-400 text-xs flex items-center gap-1">
            View All <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        
        {progressImages.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {progressImages.slice(0, 8).map((img) => (
              <button
                key={img.id}
                onClick={() => setSelectedImage(img)}
                className="aspect-square relative rounded-lg overflow-hidden bg-zinc-800 hover:ring-2 hover:ring-yellow-400 transition-all"
              >
                <Image
                  src={img.image_url}
                  alt="Progress"
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <Camera className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">No progress photos yet</p>
            <Link href="/profile" className="text-yellow-400 text-sm mt-2 inline-block">
              Add photos →
            </Link>
          </div>
        )}
      </section>

      {/* Workout History Link */}
      <section>
        <Link 
          href="/history"
          className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-white font-medium">Workout History</p>
              <p className="text-zinc-500 text-xs">View all completed workouts</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-500" />
        </Link>
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
            <p className="text-white font-medium text-center mt-4">
              {formatDate(selectedImage.created_at)}
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
