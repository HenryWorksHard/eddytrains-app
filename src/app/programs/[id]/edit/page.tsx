'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, ChevronDown, Trash2 } from 'lucide-react'
import WorkoutBuilder, { Workout } from '@/components/WorkoutBuilder'
import Sidebar from '@/components/Sidebar'

const categories = [
  { value: 'strength', label: 'Strength Training', icon: 'S' },
  { value: 'cardio', label: 'Cardio', icon: 'C' },
  { value: 'hyrox', label: 'Hyrox', icon: 'H' },
  { value: 'hybrid', label: 'Hybrid', icon: 'HY' },
]

const difficulties = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EditProgramPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Program details
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('strength')
  const [difficulty, setDifficulty] = useState('intermediate')
  const [durationWeeks, setDurationWeeks] = useState<number | null>(null)
  const [isActive, setIsActive] = useState(true)

  // Workouts
  const [workouts, setWorkouts] = useState<Workout[]>([])

  // Load program data
  useEffect(() => {
    async function loadProgram() {
      try {
        const response = await fetch(`/api/programs/${id}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load program')
        }

        const { program, workouts: workoutsData } = data

        setName(program.name)
        setDescription(program.description || '')
        setCategory(program.category)
        setDifficulty(program.difficulty)
        setDurationWeeks(program.duration_weeks)
        setIsActive(program.is_active)

        // Transform to our format
        const transformedWorkouts: Workout[] = (workoutsData || []).map((w: any) => ({
          id: w.id,
          name: w.name,
          dayOfWeek: w.day_of_week,
          order: w.order_index,
          notes: w.notes || '',
          isEmom: w.is_emom || false,
          emomInterval: w.emom_interval || null,
          warmupExercises: w.warmup_exercises || [],
          recoveryNotes: w.recovery_notes || '',
          weekNumber: w.week_number || 1,
          exercises: (w.workout_exercises || [])
            .sort((a: any, b: any) => a.order_index - b.order_index)
            .map((ex: any) => ({
              id: ex.id,
              exerciseId: ex.exercise_id,
              exerciseName: ex.exercise_name,
              category: ex.category || 'strength',
              order: ex.order_index,
              notes: ex.notes || '',
              supersetGroup: ex.superset_group,
              sets: (ex.exercise_sets || [])
                .sort((a: any, b: any) => a.set_number - b.set_number)
                .map((s: any) => ({
                  id: s.id,
                  setNumber: s.set_number,
                  reps: s.reps,
                  intensityType: s.intensity_type,
                  intensityValue: s.intensity_value,
                  restSeconds: s.rest_seconds,
                  restBracket: s.rest_bracket || '90-120',
                  weightType: s.weight_type || 'freeweight',
                  notes: s.notes || '',
                  // Cardio fields
                  cardioType: s.cardio_type || null,
                  cardioValue: s.cardio_value || null,
                  cardioUnit: s.cardio_unit || null,
                  heartRateZone: s.heart_rate_zone || null,
                  workTime: s.work_time || null,
                  restTime: s.rest_time || null,
                  // Hyrox fields
                  hyroxStation: s.hyrox_station || null,
                  hyroxDistance: s.hyrox_distance || null,
                  hyroxUnit: s.hyrox_unit || null,
                  hyroxTargetTime: s.hyrox_target_time || null,
                  hyroxWeightClass: s.hyrox_weight_class || null,
                })),
            })),
          finisher: w.finisher ? {
            id: w.finisher.id,
            name: w.finisher.name,
            category: w.finisher.category,
            notes: w.finisher.notes || '',
            isEmom: w.finisher.is_emom || false,
            emomInterval: w.finisher.emom_interval || 60,
            isSuperset: w.finisher.is_superset || false,
            exercises: (w.finisher.workout_exercises || [])
              .sort((a: any, b: any) => a.order_index - b.order_index)
              .map((ex: any) => ({
                id: ex.id,
                exerciseId: ex.exercise_id,
                exerciseName: ex.exercise_name,
                category: ex.category || 'strength',
                order: ex.order_index,
                notes: ex.notes || '',
                sets: (ex.exercise_sets || [])
                  .sort((a: any, b: any) => a.set_number - b.set_number)
                  .map((s: any) => ({
                    id: s.id,
                    setNumber: s.set_number,
                    reps: s.reps,
                    intensityType: s.intensity_type,
                    intensityValue: s.intensity_value,
                    restSeconds: s.rest_seconds,
                    restBracket: s.rest_bracket || '90-120',
                    weightType: s.weight_type || 'freeweight',
                    notes: s.notes || '',
                    // Cardio fields
                    cardioType: s.cardio_type || null,
                    cardioValue: s.cardio_value || null,
                    cardioUnit: s.cardio_unit || null,
                    heartRateZone: s.heart_rate_zone || null,
                    workTime: s.work_time || null,
                    restTime: s.rest_time || null,
                    // Hyrox fields
                    hyroxStation: s.hyrox_station || null,
                    hyroxDistance: s.hyrox_distance || null,
                    hyroxUnit: s.hyrox_unit || null,
                    hyroxTargetTime: s.hyrox_target_time || null,
                    hyroxWeightClass: s.hyrox_weight_class || null,
                  })),
              })),
          } : undefined,
        }))

        setWorkouts(transformedWorkouts)
      } catch (err) {
        console.error('Error loading program:', err)
        setError(err instanceof Error ? err.message : 'Failed to load program')
      } finally {
        setLoading(false)
      }
    }

    loadProgram()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('Program name is required')
      return
    }

    // Check that all workouts have a day assigned
    const workoutsWithoutDay = workouts.filter(w => w.dayOfWeek === null)
    if (workoutsWithoutDay.length > 0) {
      setError(`Please assign a day to all workouts. Missing: ${workoutsWithoutDay.map(w => w.name).join(', ')}`)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/programs/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name,
          description,
          category,
          difficulty,
          durationWeeks,
          isActive,
          workouts,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update program')
      }

      // Success - redirect to programs list
      router.push('/programs')
      router.refresh()

    } catch (err) {
      console.error('Error updating program:', err)
      setError(err instanceof Error ? err.message : 'Failed to update program')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this program? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/programs/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete program')
      }

      router.push('/programs')
      router.refresh()
    } catch (err) {
      console.error('Error deleting program:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete program')
      setDeleting(false)
    }
  }

  const selectedCategory = categories.find(c => c.value === category)

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Sidebar />
        <main className="lg:ml-64 p-4 lg:p-8 pt-20 lg:pt-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="lg:ml-64 p-4 lg:p-8 pt-20 lg:pt-8">
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/programs"
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedCategory?.icon}</span>
                  <h1 className="text-2xl lg:text-3xl font-bold text-white">Edit Program</h1>
                </div>
                <p className="text-zinc-400 mt-1">Update program details and workouts</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-4 py-2.5 rounded-xl font-medium transition-colors"
              >
                {deleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
                <span className="hidden sm:inline">Delete</span>
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black px-6 py-2.5 rounded-xl font-medium transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
              {error}
            </div>
          )}

          {/* Program Details */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <h2 className="text-xl font-semibold text-white">Program Details</h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Program Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="e.g., 12-Week Strength Builder"
                  required
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
                  rows={3}
                  placeholder="Describe the program goals, target audience, and what to expect..."
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Category
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full appearance-none px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 pr-10"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Difficulty
                </label>
                <div className="relative">
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full appearance-none px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 pr-10"
                  >
                    {difficulties.map(diff => (
                      <option key={diff.value} value={diff.value}>{diff.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Duration (weeks)
                </label>
                <input
                  type="number"
                  value={durationWeeks || ''}
                  onChange={(e) => setDurationWeeks(e.target.value ? parseInt(e.target.value) : null)}
                  min="1"
                  max="52"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="e.g., 12"
                />
              </div>

              {/* Active Status */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Status
                </label>
                <label className="flex items-center gap-3 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl cursor-pointer hover:bg-zinc-700/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-5 h-5 rounded border-zinc-600 bg-zinc-700 text-yellow-400 focus:ring-yellow-400 focus:ring-offset-0"
                  />
                  <span className="text-white">Active (visible to clients)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Workouts Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Workouts</h2>
                <p className="text-zinc-400 text-sm mt-1">Add workout days and their exercises</p>
              </div>
              <span className="text-sm text-zinc-500">
                {workouts.length} workout{workouts.length !== 1 ? 's' : ''} • {workouts.reduce((acc, w) => acc + w.exercises.length, 0)} exercises
              </span>
            </div>

            <WorkoutBuilder workouts={workouts} onChange={setWorkouts} programType={category} />
          </div>
        </form>
      </main>
    </div>
  )
}
