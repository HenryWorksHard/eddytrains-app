'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'
import { Dumbbell, Users, Clock, Edit2, Trash2, Copy, X } from 'lucide-react'

interface Program {
  id: string
  name: string
  description: string | null
  category: string
  duration_weeks: number | null
  difficulty: string
  is_active: boolean
}

const categoryColors: Record<string, string> = {
  strength: 'from-blue-500 to-blue-600',
  cardio: 'from-green-500 to-green-600',
  hyrox: 'from-yellow-400 to-yellow-500',
  hybrid: 'from-purple-500 to-purple-600',
  nutrition: 'from-teal-500 to-teal-600',
  recovery: 'from-pink-500 to-pink-600',
}

const difficultyBadges: Record<string, string> = {
  beginner: 'badge-success',
  intermediate: 'badge-warning',
  advanced: 'badge-error',
}

export default function ProgramCard({ program }: { program: Program }) {
  const router = useRouter()
  const supabase = createClient()
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [newName, setNewName] = useState(`${program.name} (Copy)`)
  const [duplicating, setDuplicating] = useState(false)
  const [error, setError] = useState('')

  const handleDuplicate = async () => {
    if (!newName.trim()) {
      setError('Please enter a program name')
      return
    }

    if (newName.trim() === program.name) {
      setError('Please choose a different name')
      return
    }

    setDuplicating(true)
    setError('')

    try {
      // 1. Get the full program with workouts, exercises, and sets
      const { data: fullProgram, error: fetchError } = await supabase
        .from('programs')
        .select(`
          *,
          program_workouts (
            *,
            workout_exercises (
              *,
              exercise_sets (*)
            )
          )
        `)
        .eq('id', program.id)
        .single()

      if (fetchError) throw fetchError

      // 2. Create new program (preserve organization_id from original)
      const { data: newProgram, error: programError } = await supabase
        .from('programs')
        .insert({
          name: newName.trim(),
          description: fullProgram.description,
          category: fullProgram.category,
          difficulty: fullProgram.difficulty,
          duration_weeks: fullProgram.duration_weeks,
          is_active: true,
          organization_id: fullProgram.organization_id,
        })
        .select()
        .single()

      if (programError) throw programError

      // 3. Copy workouts
      for (const workout of fullProgram.program_workouts || []) {
        const { data: newWorkout, error: workoutError } = await supabase
          .from('program_workouts')
          .insert({
            program_id: newProgram.id,
            name: workout.name,
            day_of_week: workout.day_of_week,
            order_index: workout.order_index,
            notes: workout.notes,
          })
          .select()
          .single()

        if (workoutError) throw workoutError

        // 4. Copy exercises
        for (const exercise of workout.workout_exercises || []) {
          const { data: newExercise, error: exerciseError } = await supabase
            .from('workout_exercises')
            .insert({
              workout_id: newWorkout.id,
              exercise_id: exercise.exercise_id,
              exercise_name: exercise.exercise_name,
              order_index: exercise.order_index,
              notes: exercise.notes,
              superset_group: exercise.superset_group,
            })
            .select()
            .single()

          if (exerciseError) throw exerciseError

          // 5. Copy sets
          if (exercise.exercise_sets?.length > 0) {
            const setsToInsert = exercise.exercise_sets.map((set: any) => ({
              exercise_id: newExercise.id,
              set_number: set.set_number,
              reps: set.reps,
              intensity_type: set.intensity_type,
              intensity_value: set.intensity_value,
              rest_seconds: set.rest_seconds,
              rest_bracket: set.rest_bracket,
              weight_type: set.weight_type,
              notes: set.notes,
            }))

            const { error: setsError } = await supabase
              .from('exercise_sets')
              .insert(setsToInsert)

            if (setsError) throw setsError
          }
        }
      }

      // Success - close modal and refresh
      setShowDuplicateModal(false)
      router.refresh()
    } catch (err) {
      console.error('Error duplicating program:', err)
      setError(err instanceof Error ? err.message : 'Failed to duplicate program')
    } finally {
      setDuplicating(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${program.name}"? This cannot be undone.`)) {
      return
    }

    const { error } = await supabase
      .from('programs')
      .delete()
      .eq('id', program.id)

    if (!error) {
      router.refresh()
    }
  }

  return (
    <>
      <div className="card p-6 group">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${categoryColors[program.category] || 'from-zinc-500 to-zinc-600'} flex items-center justify-center`}>
            <Dumbbell className="w-6 h-6 text-white" />
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setShowDuplicateModal(true)}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-yellow-400 transition-colors"
              title="Duplicate program"
            >
              <Copy className="w-4 h-4" />
            </button>
            <Link
              href={`/programs/${program.id}/edit`}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Edit program"
            >
              <Edit2 className="w-4 h-4" />
            </Link>
            <button
              onClick={handleDelete}
              className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors"
              title="Delete program"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <h3 className="text-xl font-semibold text-white mb-2">{program.name}</h3>
        <p className="text-zinc-400 text-sm mb-4 line-clamp-2">
          {program.description || 'No description'}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="badge badge-info capitalize">{program.category}</span>
          <span className={`badge ${difficultyBadges[program.difficulty] || 'badge-info'} capitalize`}>
            {program.difficulty}
          </span>
          {!program.is_active && (
            <span className="badge badge-error">Inactive</span>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-zinc-500">
          {program.duration_weeks && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {program.duration_weeks} weeks
            </div>
          )}
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            0 enrolled
          </div>
        </div>
      </div>

      {/* Duplicate Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Duplicate Program</h3>
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-zinc-400 text-sm mb-4">
              Create a copy of "{program.name}" with all workouts and exercises.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                New Program Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-yellow-400"
                placeholder="Enter new program name"
                autoFocus
              />
              {error && (
                <p className="text-red-400 text-sm mt-2">{error}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="flex-1 px-4 py-3 border border-zinc-700 text-zinc-300 rounded-xl hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDuplicate}
                disabled={duplicating}
                className="flex-1 px-4 py-3 bg-yellow-400 text-black font-semibold rounded-xl hover:bg-yellow-300 transition-colors disabled:opacity-50"
              >
                {duplicating ? 'Duplicating...' : 'Duplicate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
