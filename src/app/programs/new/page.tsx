'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, ChevronDown } from 'lucide-react'
import WorkoutBuilder, { Workout } from '@/components/WorkoutBuilder'

const categories = [
  { value: 'strength', label: 'Strength Training', icon: 'S', description: 'Build muscle and increase strength' },
  { value: 'cardio', label: 'Cardio', icon: 'C', description: 'Improve cardiovascular fitness' },
  { value: 'hyrox', label: 'Hyrox', icon: 'H', description: 'Train for Hyrox competitions' },
  { value: 'hybrid', label: 'Hybrid', icon: 'HY', description: 'Combine strength and cardio' },
]

const difficulties = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export default function CreateProgramPage() {
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step tracking
  const [category, setCategory] = useState<string | null>(null)

  // Program details (shown after category selected)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState('intermediate')
  const [durationWeeks, setDurationWeeks] = useState(4)
  const [isActive, setIsActive] = useState(true)

  // Workouts
  const [workouts, setWorkouts] = useState<Workout[]>([])

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
      const response = await fetch('/api/programs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        throw new Error(data.error || 'Failed to create program')
      }

      // Success - redirect to programs list
      router.push('/programs')
      router.refresh()

    } catch (err) {
      console.error('Error creating program:', err)
      setError(err instanceof Error ? err.message : 'Failed to create program')
    } finally {
      setSaving(false)
    }
  }

  // Step 1: Category Selection
  if (!category) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/programs"
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">Create Program</h1>
            <p className="text-zinc-400 mt-1">First, select the program type</p>
          </div>
        </div>

        {/* Category Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {categories.map(cat => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className="p-6 bg-zinc-900 border border-zinc-800 hover:border-yellow-400/50 rounded-2xl text-left transition-all hover:bg-zinc-800/50 group"
            >
              <div className="text-4xl mb-3">{cat.icon}</div>
              <h3 className="text-xl font-semibold text-white group-hover:text-yellow-400 transition-colors">
                {cat.label}
              </h3>
              <p className="text-zinc-500 text-sm mt-1">{cat.description}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Step 2: Program Details (after category selected)
  const selectedCategory = categories.find(c => c.value === category)

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selectedCategory?.icon}</span>
              <h1 className="text-3xl font-bold text-white">New {selectedCategory?.label} Program</h1>
            </div>
            <p className="text-zinc-400 mt-1">Configure your program details and workouts</p>
          </div>
        </div>

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
          {saving ? 'Saving...' : 'Save Program'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {/* Program Details */}
      <div className="card p-6 space-y-6">
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
            <div className="relative">
              <select
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(parseInt(e.target.value))}
                className="w-full appearance-none px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 pr-10"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16].map(w => (
                  <option key={w} value={w}>{w} week{w !== 1 ? 's' : ''}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
            </div>
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

        <WorkoutBuilder workouts={workouts} onChange={setWorkouts} programType={category || undefined} />
      </div>
    </form>
  )
}
// trigger deploy Tue Feb  3 15:21:00 ACDT 2026
