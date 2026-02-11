'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase/client'
import Image from 'next/image'
import Link from 'next/link'
import { Flame, Weight, Camera, Dumbbell, ChevronRight, TrendingUp, ChevronDown } from 'lucide-react'

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

interface ProgressPoint {
  date: string
  weight: number
  reps: number
}

interface ProgressClientProps {
  oneRMs: OneRM[]
  progressImages: ProgressImage[]
  weeklyTonnage: number
  exerciseNames: string[]
  clientId: string
}

type TonnagePeriod = 'day' | 'week' | 'month' | 'year'

export default function ProgressClient({ 
  oneRMs, 
  progressImages, 
  weeklyTonnage: initialTonnage,
  exerciseNames,
  clientId 
}: ProgressClientProps) {
  const [streak, setStreak] = useState({ current: 0, longest: 0 })
  const [selectedImage, setSelectedImage] = useState<ProgressImage | null>(null)
  const [tonnagePeriod, setTonnagePeriod] = useState<TonnagePeriod>('week')
  const [tonnage, setTonnage] = useState(initialTonnage)
  const [loadingTonnage, setLoadingTonnage] = useState(false)
  
  // Exercise progression
  const [allExercises, setAllExercises] = useState<string[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [progressionData, setProgressionData] = useState<ProgressPoint[]>([])
  const [loadingProgression, setLoadingProgression] = useState(false)
  const [exerciseDropdownOpen, setExerciseDropdownOpen] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    fetchStreak()
    fetchAllExercises()
  }, [])

  useEffect(() => {
    fetchTonnage(tonnagePeriod)
  }, [tonnagePeriod])

  useEffect(() => {
    if (selectedExercise) {
      fetchProgression(selectedExercise)
    }
  }, [selectedExercise])

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

  const fetchTonnage = async (period: TonnagePeriod) => {
    setLoadingTonnage(true)
    try {
      const now = new Date()
      let startDate: Date
      
      switch (period) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          startDate = new Date(now)
          startDate.setDate(startDate.getDate() - 7)
          break
        case 'month':
          startDate = new Date(now)
          startDate.setMonth(startDate.getMonth() - 1)
          break
        case 'year':
          startDate = new Date(now)
          startDate.setFullYear(startDate.getFullYear() - 1)
          break
      }

      const { data: logs } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('client_id', clientId)
        .gte('completed_at', startDate.toISOString())

      const logIds = logs?.map(l => l.id) || []
      
      if (logIds.length > 0) {
        const { data: setLogs } = await supabase
          .from('set_logs')
          .select('weight_kg, reps_completed')
          .in('workout_log_id', logIds)

        const total = setLogs?.reduce((sum, s) => {
          return sum + ((s.weight_kg || 0) * (s.reps_completed || 0))
        }, 0) || 0
        
        setTonnage(total)
      } else {
        setTonnage(0)
      }
    } catch (err) {
      console.error('Failed to fetch tonnage:', err)
    }
    setLoadingTonnage(false)
  }

  const fetchAllExercises = async () => {
    try {
      // Get all unique exercises the user has logged
      const { data: logs } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('client_id', clientId)
        .order('completed_at', { ascending: false })
        .limit(50)

      const logIds = logs?.map(l => l.id) || []
      
      if (logIds.length > 0) {
        const { data: setLogs } = await supabase
          .from('set_logs')
          .select('exercise_id, workout_exercises(exercise_name)')
          .in('workout_log_id', logIds)

        const names = [...new Set(
          setLogs?.map(s => (s.workout_exercises as any)?.exercise_name).filter(Boolean) || []
        )].sort()
        
        setAllExercises(names)
        if (names.length > 0 && !selectedExercise) {
          setSelectedExercise(names[0])
        }
      }
    } catch (err) {
      console.error('Failed to fetch exercises:', err)
    }
  }

  const fetchProgression = async (exerciseName: string) => {
    setLoadingProgression(true)
    try {
      // Get workout logs with this exercise
      const { data: logs } = await supabase
        .from('workout_logs')
        .select(`
          id,
          completed_at,
          set_logs (
            weight_kg,
            reps_completed,
            workout_exercises (exercise_name)
          )
        `)
        .eq('client_id', clientId)
        .order('completed_at', { ascending: true })
        .limit(30)

      const points: ProgressPoint[] = []
      
      logs?.forEach(log => {
        const exerciseSets = (log.set_logs as any[])?.filter(
          s => s.workout_exercises?.exercise_name === exerciseName && s.weight_kg > 0
        ) || []
        
        if (exerciseSets.length > 0) {
          // Get best set (highest weight)
          const bestSet = exerciseSets.reduce((best, s) => 
            s.weight_kg > best.weight_kg ? s : best
          , exerciseSets[0])
          
          points.push({
            date: new Date(log.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            weight: bestSet.weight_kg,
            reps: bestSet.reps_completed || 0
          })
        }
      })
      
      setProgressionData(points)
    } catch (err) {
      console.error('Failed to fetch progression:', err)
    }
    setLoadingProgression(false)
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

  const periodLabels: Record<TonnagePeriod, string> = {
    day: 'Today',
    week: 'This Week',
    month: 'This Month',
    year: 'This Year'
  }

  // Simple chart component
  const ProgressChart = ({ data }: { data: ProgressPoint[] }) => {
    if (data.length === 0) {
      return (
        <div className="h-32 flex items-center justify-center text-zinc-500 text-sm">
          No data yet
        </div>
      )
    }

    const maxWeight = Math.max(...data.map(d => d.weight))
    const minWeight = Math.min(...data.map(d => d.weight))
    const range = maxWeight - minWeight || 1

    return (
      <div className="h-32 flex items-end gap-1">
        {data.map((point, i) => {
          const height = ((point.weight - minWeight) / range) * 80 + 20
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div 
                className="w-full bg-yellow-400 rounded-t transition-all"
                style={{ height: `${height}%` }}
                title={`${point.weight}kg x ${point.reps}`}
              />
              {data.length <= 10 && (
                <span className="text-[8px] text-zinc-500 truncate w-full text-center">
                  {point.date.split(' ')[0]}
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <main className="px-4 py-4 space-y-6">
      {/* 1. Streak */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center">
              <Flame className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{streak.current}</p>
              <p className="text-xs text-zinc-500">Day Streak</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-zinc-400">{streak.longest}</p>
            <p className="text-xs text-zinc-500">Best</p>
          </div>
        </div>
      </section>

      {/* 2. Tonnage with selector */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Weight className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-medium text-white">Total Volume</h3>
          </div>
          <div className="flex gap-1">
            {(['day', 'week', 'month', 'year'] as TonnagePeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => setTonnagePeriod(period)}
                className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                  tonnagePeriod === period
                    ? 'bg-yellow-400 text-black font-medium'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <p className="text-3xl font-bold text-white">
          {loadingTonnage ? '...' : formatTonnage(tonnage)}
        </p>
        <p className="text-xs text-zinc-500">{periodLabels[tonnagePeriod]}</p>
      </section>

      {/* 3. Exercise Progression */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <h3 className="text-sm font-medium text-white">Exercise Progress</h3>
          </div>
        </div>
        
        {/* Exercise Selector */}
        <div className="relative mb-4">
          <button
            onClick={() => setExerciseDropdownOpen(!exerciseDropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
          >
            <span>{selectedExercise || 'Select exercise'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${exerciseDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {exerciseDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg max-h-48 overflow-y-auto z-10">
              {allExercises.map((exercise) => (
                <button
                  key={exercise}
                  onClick={() => {
                    setSelectedExercise(exercise)
                    setExerciseDropdownOpen(false)
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-700 transition-colors ${
                    selectedExercise === exercise ? 'text-yellow-400' : 'text-white'
                  }`}
                >
                  {exercise}
                </button>
              ))}
              {allExercises.length === 0 && (
                <p className="px-3 py-2 text-zinc-500 text-sm">No exercises logged yet</p>
              )}
            </div>
          )}
        </div>

        {/* Chart */}
        {loadingProgression ? (
          <div className="h-32 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ProgressChart data={progressionData} />
        )}
        
        {progressionData.length > 0 && (
          <div className="flex justify-between mt-2 text-xs text-zinc-500">
            <span>Best: {Math.max(...progressionData.map(d => d.weight))}kg</span>
            <span>{progressionData.length} sessions</span>
          </div>
        )}
      </section>

      {/* 4. 1RM Records */}
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

      {/* 5. Progress Photos */}
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
