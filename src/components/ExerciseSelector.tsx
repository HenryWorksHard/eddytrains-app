'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Search, X, Dumbbell, ChevronDown, Check, Layers, Loader2, AlertTriangle } from 'lucide-react'
import {
  MUSCLE_GROUPS, EQUIPMENT_GROUPS, matchesMuscleGroup, matchesEquipmentGroup,
  type FilterGroup,
} from '@/data/exercise-filters'

interface Exercise {
  id: string
  name: string
  category: string
  equipment: string[]
  movementPattern: string
  primaryMuscles: string[]
  difficulty: string
  tags?: string[]
  exerciseType?: 'strength' | 'cardio' | 'steps' | 'timed'
}

interface ExerciseSelectorProps {
  onSelect: (exercise: Exercise) => void
  onSelectSuperset?: (exercises: Exercise[]) => void
  onClose: () => void
  allowSuperset?: boolean
  programType?: string // 'strength' | 'cardio' | 'hyrox' | 'hybrid'
}

// Keyed by muscle-group id, not by `category`. The badge used to read
// `exercise.category` against these keys, but the library's category column
// holds the exercise TYPE ("strength" for 1,296 of 1,463 rows), so almost
// every badge fell through to the grey default and said "strength". The body
// part is the useful thing to see while scanning a list, and it comes from
// primaryMuscles.
const groupColors: Record<string, string> = {
  chest: 'bg-red-500/20 text-red-400 border-red-500/30',
  back: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  shoulders: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  biceps: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  triceps: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  forearms: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  quads: 'bg-green-500/20 text-green-400 border-green-500/30',
  hamstrings: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  calves: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  glutes: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  core: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  neck: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  fullbody: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  cardio: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}

// The library is the same for everybody and only changes through a migration,
// so it is fetched once per page load rather than once per modal. Building a
// six-day program means opening this picker a few dozen times, and each open
// used to re-download and re-parse ~470 KB of JSON.
let libraryCache: Exercise[] | null = null
let libraryRequest: Promise<Exercise[]> | null = null

function loadLibrary(): Promise<Exercise[]> {
  if (libraryCache) return Promise.resolve(libraryCache)
  // A second modal opening mid-flight joins the first request instead of
  // starting another one.
  libraryRequest ??= fetch('/api/exercises')
    .then(async (res) => {
      if (!res.ok) throw new Error(`Exercise library returned ${res.status}`)
      const data = await res.json()
      if (!data.exercises?.length) throw new Error('Exercise library came back empty')
      libraryCache = data.exercises as Exercise[]
      return libraryCache
    })
    .finally(() => { libraryRequest = null })
  return libraryRequest
}

/** The muscle group an exercise belongs to, for the badge in the list. */
function groupOf(ex: Exercise): FilterGroup | undefined {
  return MUSCLE_GROUPS.find((g) => matchesMuscleGroup(ex.primaryMuscles, g.id))
}

// Format muscle names: "front_delts" -> "Front Delts"
function formatMuscleName(muscle: string): string {
  return muscle
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default function ExerciseSelector({ onSelect, onSelectSuperset, onClose, allowSuperset = true, programType }: ExerciseSelectorProps) {
  const [search, setSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null)
  const [isSupersetMode, setIsSupersetMode] = useState(false)
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([])
  const [showAllExercises, setShowAllExercises] = useState(false)
  // Seeded from the cache so a second open paints the list on the first
  // frame instead of flashing a spinner.
  const [exercises, setExercises] = useState<Exercise[]>(() => libraryCache ?? [])
  const [loading, setLoading] = useState(() => libraryCache === null)
  const [loadError, setLoadError] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // There is deliberately no bundled fallback list any more.
  //
  // It used to fall back to a 102-exercise seed file whose ids are slugs
  // ("barbell_bench_press") while everything in the library carries a Supabase
  // UUID. Picking from that fallback wrote an id into the program that matches
  // no exercise, so a silent network blip produced a quietly broken program.
  // Failing visibly with a retry is the safer trade, and it drops 72 KB of
  // JSON from the bundle.
  const load = useCallback(() => {
    setLoadError(false)
    setLoading(true)
    loadLibrary()
      .then(setExercises)
      .catch((err) => {
        console.error('Failed to load the exercise library:', err)
        setLoadError(true)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { if (libraryCache === null) load() }, [load])

  useEffect(() => {
    searchRef.current?.focus()
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // One pass, memoised. This used to run twice over all 1,463 exercises on
  // every render, re-lower-casing the search term inside both loops, so each
  // keystroke did ~6,000 string allocations before painting.
  const { filteredExercises, totalMatchingExercises } = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matching: Exercise[] = []   // ignores the program-type tag filter
    const shown: Exercise[] = []      // what the list actually renders

    for (const ex of exercises) {
      if (q && !ex.name.toLowerCase().includes(q) &&
          !ex.primaryMuscles.some((m) => m.toLowerCase().includes(q))) continue
      if (selectedGroup && !matchesMuscleGroup(ex.primaryMuscles, selectedGroup)) continue
      if (selectedEquipment && !matchesEquipmentGroup(ex.equipment, selectedEquipment)) continue
      matching.push(ex)
      if (!programType || showAllExercises || ex.tags?.includes(programType)) shown.push(ex)
    }
    return { filteredExercises: shown, totalMatchingExercises: matching.length }
  }, [exercises, search, selectedGroup, selectedEquipment, programType, showAllExercises])

  const handleExerciseClick = (exercise: Exercise) => {
    if (isSupersetMode) {
      // Toggle selection
      if (selectedExercises.find(e => e.id === exercise.id)) {
        setSelectedExercises(selectedExercises.filter(e => e.id !== exercise.id))
      } else {
        setSelectedExercises([...selectedExercises, exercise])
      }
    } else {
      onSelect(exercise)
    }
  }

  const handleAddSuperset = () => {
    if (selectedExercises.length >= 2 && onSelectSuperset) {
      onSelectSuperset(selectedExercises)
    }
  }

  const isSelected = (exerciseId: string) => {
    return selectedExercises.some(e => e.id === exerciseId)
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        ref={modalRef}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">
              {isSupersetMode ? 'Select Superset Exercises' : 'Select Exercise'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Toggle */}
          {allowSuperset && (
            <div className="flex items-center gap-2 mb-4 p-1 bg-zinc-800 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setIsSupersetMode(false)
                  setSelectedExercises([])
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  !isSupersetMode 
                    ? 'bg-zinc-600 text-white shadow-sm' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Dumbbell className={`w-4 h-4 ${!isSupersetMode ? 'text-white' : ''}`} />
                Individual
              </button>
              <button
                type="button"
                onClick={() => setIsSupersetMode(true)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  isSupersetMode 
                    ? 'bg-yellow-400 text-black shadow-sm' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Layers className={`w-4 h-4 ${isSupersetMode ? 'text-black' : ''}`} />
                Superset
              </button>
            </div>
          )}

          {/* Superset selection indicator */}
          {isSupersetMode && selectedExercises.length > 0 && (
            <div className="mb-4 p-3 bg-yellow-400/10 border border-yellow-400/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-yellow-400 font-medium">
                    {selectedExercises.length} exercise{selectedExercises.length !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedExercises.map((ex, i) => (
                      <span key={ex.id} className="text-xs text-zinc-400">
                        {ex.name}{i < selectedExercises.length - 1 ? ' →' : ''}
                      </span>
                    ))}
                  </div>
                </div>
                {selectedExercises.length >= 2 && (
                  <button
                    type="button"
                    onClick={handleAddSuperset}
                    className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors"
                  >
                    Add Superset
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises..."
              className="w-full pl-12 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <select
                value={selectedGroup || ''}
                onChange={(e) => setSelectedGroup(e.target.value || null)}
                className="w-full appearance-none px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 pr-10"
              >
                <option value="">All Muscles</option>
                {MUSCLE_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
            </div>

            <div className="relative flex-1">
              <select
                value={selectedEquipment || ''}
                onChange={(e) => setSelectedEquipment(e.target.value || null)}
                className="w-full appearance-none px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 pr-10"
              >
                <option value="">All Equipment</option>
                {EQUIPMENT_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          {/* Show all exercises toggle - only if filtering by program type */}
          {programType && !showAllExercises && filteredExercises.length < totalMatchingExercises && (
            <button
              type="button"
              onClick={() => setShowAllExercises(true)}
              className="mt-3 text-sm text-yellow-400 hover:text-yellow-300 transition-colors"
            >
              Showing {filteredExercises.length} {programType} exercises • Show all {totalMatchingExercises} exercises
            </button>
          )}
          {showAllExercises && programType && (
            <button
              type="button"
              onClick={() => setShowAllExercises(false)}
              className="mt-3 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              ← Back to {programType} exercises only
            </button>
          )}
        </div>

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredExercises.length > 0 ? (
            <div className="space-y-2">
              {filteredExercises.map((exercise) => {
                const selected = isSelected(exercise.id)
                return (
                  <button
                    type="button"
                    key={exercise.id}
                    onClick={() => handleExerciseClick(exercise)}
                    className={`w-full flex items-center gap-4 p-4 border rounded-xl transition-all text-left group ${
                      selected
                        ? 'bg-yellow-400/10 border-yellow-400/50 hover:border-yellow-400'
                        : 'bg-zinc-800/50 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {isSupersetMode && (
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        selected 
                          ? 'bg-yellow-400 border-yellow-400' 
                          : 'border-zinc-600 group-hover:border-zinc-500'
                      }`}>
                        {selected && <Check className="w-4 h-4 text-black" />}
                      </div>
                    )}
                    <div className="w-12 h-12 rounded-xl bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                      <Dumbbell className={`w-6 h-6 transition-colors ${
                        selected ? 'text-yellow-500' : 'text-zinc-500 dark:text-zinc-400 group-hover:text-yellow-500'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold transition-colors ${
                        selected ? 'text-yellow-400' : 'text-white group-hover:text-yellow-400'
                      }`}>
                        {exercise.name}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {(() => {
                          const g = groupOf(exercise)
                          return (
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${g ? groupColors[g.id] : 'bg-zinc-700 text-zinc-400'}`}>
                              {g ? g.label : exercise.category}
                            </span>
                          )
                        })()}
                        <span className="text-xs text-zinc-500">
                          {exercise.primaryMuscles.slice(0, 2).map(formatMuscleName).join(', ')}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-600 capitalize">{exercise.difficulty}</span>
                  </button>
                )
              })}
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-yellow-400 mx-auto mb-3 animate-spin" />
              <p className="text-zinc-500">Loading exercises...</p>
            </div>
          ) : loadError ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
              <p className="text-white font-medium">Could not load the exercise library</p>
              <p className="text-zinc-500 text-sm mt-1">Check your connection and try again.</p>
              <button
                type="button"
                onClick={load}
                className="mt-4 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="text-center py-12">
              <Dumbbell className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500">No exercises found</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-sm text-zinc-500">
            {filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''} available
          </span>
          {isSupersetMode && (
            <span className="text-sm text-zinc-500">
              Select 2+ exercises to create a superset
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
