'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { TrendingUp, Flame, Weight, Save, Loader2, Edit2, Camera, ChevronDown, Download } from 'lucide-react'
import ExportProgressModal from './ExportProgressModal'
import UserProgressGallery from '../UserProgressGallery'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

interface ProgressTabProps {
  clientId: string
  clientName?: string
}

interface OneRMRecord {
  exercise_name: string
  weight_kg: number
  updated_at: string
}

interface Streak {
  current_streak: number
  longest_streak: number
  last_workout_date: string
}

interface ExerciseOption {
  id: string
  name: string
}

interface ProgressionPoint {
  date: string
  weight: number
  reps: number
}

type TonnagePeriod = 'day' | 'week' | 'month' | 'year'
type ProgressionPeriod = 'week' | 'month' | 'year'

export default function ProgressTab({ clientId, clientName = 'Client' }: ProgressTabProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [showExportModal, setShowExportModal] = useState(false)
  const [oneRMs, setOneRMs] = useState<OneRMRecord[]>([])
  const [streak, setStreak] = useState<Streak | null>(null)
  const [tonnage, setTonnage] = useState<number>(0)
  const [tonnagePeriod, setTonnagePeriod] = useState<TonnagePeriod>('week')
  const [loadingTonnage, setLoadingTonnage] = useState(false)
  const [editing1RM, setEditing1RM] = useState(false)
  const [saving1RM, setSaving1RM] = useState(false)
  const [editable1RMs, setEditable1RMs] = useState<{exercise_name: string, weight_kg: number}[]>([])
  
  // Exercise progression state
  const [exercises, setExercises] = useState<ExerciseOption[]>([])
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [progressionPeriod, setProgressionPeriod] = useState<ProgressionPeriod>('month')
  const [progressionData, setProgressionData] = useState<ProgressionPoint[]>([])
  const [loadingProgression, setLoadingProgression] = useState(false)
  const [exerciseDropdownOpen, setExerciseDropdownOpen] = useState(false)

  useEffect(() => {
    fetchProgressData()
    fetchExercises()
  }, [clientId])

  useEffect(() => {
    fetchTonnage(tonnagePeriod)
  }, [clientId, tonnagePeriod])

  useEffect(() => {
    if (selectedExercise) {
      fetchProgression(selectedExercise, progressionPeriod)
    }
  }, [selectedExercise, progressionPeriod])

  async function fetchProgressData() {
    setLoading(true)

    // Fetch 1RMs
    const { data: rmData } = await supabase
      .from('client_1rms')
      .select('exercise_name, weight_kg, updated_at')
      .eq('client_id', clientId)
      .order('weight_kg', { ascending: false })

    if (rmData) setOneRMs(rmData)

    // Fetch Streak via API (bypasses RLS)
    try {
      const streakResponse = await fetch(`/api/users/${clientId}/streak`)
      if (streakResponse.ok) {
        const { streak: streakData } = await streakResponse.json()
        if (streakData) setStreak(streakData)
      }
    } catch (err) {
      console.error('Failed to fetch streak:', err)
    }

    setLoading(false)
  }

  async function fetchTonnage(period: TonnagePeriod) {
    setLoadingTonnage(true)
    
    try {
      const response = await fetch(`/api/users/${clientId}/tonnage?period=${period}`)
      if (response.ok) {
        const { tonnage: tonnageData } = await response.json()
        setTonnage(tonnageData || 0)
      } else {
        setTonnage(0)
      }
    } catch (err) {
      console.error('Failed to fetch tonnage:', err)
      setTonnage(0)
    }

    setLoadingTonnage(false)
  }

  async function fetchExercises() {
    try {
      const response = await fetch(`/api/users/${clientId}/exercises`)
      if (response.ok) {
        const { exercises: exerciseList } = await response.json()
        setExercises(exerciseList || [])
        // Auto-select first exercise if available
        if (exerciseList && exerciseList.length > 0 && !selectedExercise) {
          setSelectedExercise(exerciseList[0].name)
        }
      }
    } catch (err) {
      console.error('Failed to fetch exercises:', err)
    }
  }

  async function fetchProgression(exerciseName: string, period: ProgressionPeriod) {
    setLoadingProgression(true)
    
    try {
      const response = await fetch(`/api/users/${clientId}/progression?exercise=${encodeURIComponent(exerciseName)}&period=${period}`)
      if (response.ok) {
        const { progression } = await response.json()
        setProgressionData(progression || [])
      } else {
        setProgressionData([])
      }
    } catch (err) {
      console.error('Failed to fetch progression:', err)
      setProgressionData([])
    }

    setLoadingProgression(false)
  }

  const startEditing1RM = () => {
    setEditable1RMs(oneRMs.map(rm => ({ exercise_name: rm.exercise_name, weight_kg: rm.weight_kg })))
    setEditing1RM(true)
  }

  const update1RM = (exercise: string, value: string) => {
    setEditable1RMs(prev => 
      prev.map(rm => 
        rm.exercise_name === exercise 
          ? { ...rm, weight_kg: parseFloat(value) || 0 }
          : rm
      )
    )
  }

  const save1RMs = async () => {
    setSaving1RM(true)
    
    for (const rm of editable1RMs) {
      await supabase
        .from('client_1rms')
        .upsert({
          client_id: clientId,
          exercise_name: rm.exercise_name,
          weight_kg: rm.weight_kg,
          updated_at: new Date().toISOString()
        }, { onConflict: 'client_id,exercise_name' })
    }

    // Refresh data
    const { data: rmData } = await supabase
      .from('client_1rms')
      .select('exercise_name, weight_kg, updated_at')
      .eq('client_id', clientId)
      .order('weight_kg', { ascending: false })
    if (rmData) setOneRMs(rmData)

    setSaving1RM(false)
    setEditing1RM(false)
  }

  const formatTonnage = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toString()
  }

  const getPeriodLabel = (period: TonnagePeriod) => {
    switch (period) {
      case 'day': return 'Today'
      case 'week': return 'This Week'
      case 'month': return 'This Month'
      case 'year': return 'This Year'
    }
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
      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors border border-zinc-700"
        >
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      {/* Export Modal */}
      <ExportProgressModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        clientId={clientId}
        clientName={clientName}
      />

      {/* Streak Card */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          Workout Streak
        </h3>
        {streak ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-orange-400">{streak.current_streak}</p>
              <p className="text-sm text-zinc-400">Current Streak</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-yellow-400">{streak.longest_streak}</p>
              <p className="text-sm text-zinc-400">Longest Streak</p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-4 text-center">
              <p className="text-lg font-medium text-white">
                {streak.last_workout_date 
                  ? new Date(streak.last_workout_date).toLocaleDateString()
                  : 'Never'}
              </p>
              <p className="text-sm text-zinc-400">Last Workout</p>
            </div>
          </div>
        ) : (
          <p className="text-zinc-500">No streak data yet</p>
        )}
      </div>

      {/* Tonnage Card */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            Tonnage
          </h3>
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            {(['day', 'week', 'month', 'year'] as TonnagePeriod[]).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setTonnagePeriod(period)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  tonnagePeriod === period
                    ? 'bg-yellow-400 text-black'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
          {loadingTonnage ? (
            <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto" />
          ) : (
            <>
              <p className="text-4xl font-bold text-green-400">{formatTonnage(tonnage)} kg</p>
              <p className="text-sm text-zinc-400 mt-1">{getPeriodLabel(tonnagePeriod)}</p>
            </>
          )}
        </div>
      </div>

      {/* Exercise Progression */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Exercise Progression</h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Exercise Selector */}
            <div className="relative">
              <button
                onClick={() => setExerciseDropdownOpen(!exerciseDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white hover:bg-zinc-700 transition-colors min-w-[180px]"
              >
                <span className="truncate">{selectedExercise || 'Select Exercise'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${exerciseDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {exerciseDropdownOpen && (
                <div className="absolute right-0 mt-1 w-64 max-h-64 overflow-y-auto bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50">
                  {exercises.map((exercise) => (
                    <button
                      key={exercise.id}
                      onClick={() => {
                        setSelectedExercise(exercise.name)
                        setExerciseDropdownOpen(false)
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-zinc-700 transition-colors ${
                        selectedExercise === exercise.name ? 'bg-zinc-700 text-yellow-400' : 'text-white'
                      }`}
                    >
                      {exercise.name}
                    </button>
                  ))}
                  {exercises.length === 0 && (
                    <p className="px-4 py-2 text-sm text-zinc-500">No exercises found</p>
                  )}
                </div>
              )}
            </div>
            {/* Period Selector */}
            <div className="flex rounded-lg overflow-hidden border border-zinc-700">
              {(['week', 'month', 'year'] as ProgressionPeriod[]).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setProgressionPeriod(period)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    progressionPeriod === period
                      ? 'bg-yellow-400 text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
          {loadingProgression ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
            </div>
          ) : progressionData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={progressionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#facc15" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#facc15" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#9ca3af" 
                    fontSize={12}
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return `${date.getDate()}/${date.getMonth() + 1}`
                    }}
                  />
                  <YAxis 
                    stroke="#9ca3af" 
                    fontSize={12}
                    tickFormatter={(value) => `${value}kg`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value) => [`${value} kg`, 'Weight']}
                    labelFormatter={(label) => {
                      const date = new Date(label)
                      return date.toLocaleDateString()
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="weight" 
                    stroke="#facc15" 
                    strokeWidth={2}
                    fill="url(#colorWeight)"
                    dot={{ fill: '#facc15', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#facc15' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-zinc-500">
              <TrendingUp className="w-12 h-12 mb-2 text-yellow-400/30" />
              <p>No progression data yet</p>
              <p className="text-sm">Complete workouts to see your progress</p>
            </div>
          )}
        </div>
      </div>

      {/* 1RM Board */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Weight className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">1RM Board</h3>
          </div>
          {editing1RM ? (
            <div className="flex gap-2">
              <button
                onClick={save1RMs}
                disabled={saving1RM}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {saving1RM ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
              <button
                onClick={() => setEditing1RM(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={startEditing1RM}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>

        {oneRMs.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {(editing1RM ? editable1RMs : oneRMs).map((rm) => (
              <div key={rm.exercise_name} className="bg-zinc-800 rounded-xl p-4">
                <p className="text-sm text-zinc-400 mb-1 truncate">{rm.exercise_name}</p>
                {editing1RM ? (
                  <input
                    type="number"
                    value={rm.weight_kg || ''}
                    onChange={(e) => update1RM(rm.exercise_name, e.target.value)}
                    className="w-full text-xl font-bold text-yellow-400 bg-zinc-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                ) : (
                  <p className="text-xl font-bold text-yellow-400">{rm.weight_kg} kg</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center mx-auto mb-3">
              <Weight className="w-7 h-7 text-zinc-600" />
            </div>
            <p className="text-zinc-400">No 1RM records yet</p>
            <p className="text-zinc-500 text-sm mt-1">1RMs will appear as the client logs workouts</p>
          </div>
        )}
      </div>

      {/* Progress Pictures */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Camera className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Progress Pictures</h3>
        </div>
        <UserProgressGallery userId={clientId} />
      </div>
    </div>
  )
}
