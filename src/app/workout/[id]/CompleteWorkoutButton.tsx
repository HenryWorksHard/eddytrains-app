'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Star, X } from 'lucide-react'
import { createClient } from '../../lib/supabase/client'

interface CompleteWorkoutButtonProps {
  workoutId: string
  clientProgramId?: string
  scheduledDate?: string
  isCompleted?: boolean
}

type Difficulty = 'too_easy' | 'just_right' | 'too_hard'

interface WorkoutRating {
  rating: number
  difficulty: Difficulty | null
  notes: string
}

// Workout Rating Modal - Compact design
function WorkoutRatingModal({
  onSubmit,
  onSkip,
  isSubmitting
}: {
  onSubmit: (rating: WorkoutRating) => void
  onSkip: () => void
  isSubmitting: boolean
}) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  
  const difficultyOptions: { value: Difficulty; label: string }[] = [
    { value: 'too_easy', label: 'Easy' },
    { value: 'just_right', label: 'Good' },
    { value: 'too_hard', label: 'Hard' },
  ]
  
  const handleSubmit = () => {
    onSubmit({ rating, difficulty, notes })
  }
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl w-full max-w-sm overflow-hidden animate-slide-up">
        {/* Header - Compact */}
        <div className="p-4 text-center">
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Nice work!</h2>
          <p className="text-zinc-500 text-sm">How was it?</p>
        </div>
        
        {/* Content - Compact */}
        <div className="px-4 pb-2 space-y-4">
          {/* Star Rating - Smaller */}
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                onClick={() => setRating(star)}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <Star
                  className={`w-8 h-8 transition-colors ${
                    star <= (hoveredRating || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-zinc-700'
                  }`}
                />
              </button>
            ))}
          </div>
          
          {/* Difficulty - Inline */}
          <div className="flex gap-2">
            {difficultyOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setDifficulty(option.value)}
                className={`flex-1 py-2.5 px-2 rounded-xl text-center transition-all ${
                  difficulty === option.value
                    ? 'bg-yellow-400 text-black'
                    : 'bg-zinc-800 text-white hover:bg-zinc-700'
                }`}
              >
                <span className="text-sm font-medium">{option.label}</span>
              </button>
            ))}
          </div>
          
          {/* Notes Toggle */}
          {!showNotes ? (
            <button
              onClick={() => setShowNotes(true)}
              className="w-full text-zinc-500 text-sm hover:text-zinc-300 transition-colors"
            >
              + Add a note
            </button>
          ) : (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes for your coach?"
              rows={2}
              autoFocus
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          )}
        </div>
        
        {/* Actions - Compact */}
        <div className="p-4 pt-2 flex gap-2">
          <button
            onClick={onSkip}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              'Done'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CompleteWorkoutButton({ 
  workoutId, 
  clientProgramId,
  scheduledDate: scheduledDateProp,
  isCompleted: initialCompleted = false 
}: CompleteWorkoutButtonProps) {
  const [isCompleted, setIsCompleted] = useState(initialCompleted)
  const [isLoading, setIsLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Watch for scroll to bottom using Intersection Observer
  useEffect(() => {
    const sentinel = document.getElementById('workout-end-sentinel')
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.1 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  const handleComplete = () => {
    if (isCompleted || isLoading) return
    setShowRatingModal(true)
  }

  const submitWorkoutCompletion = async (rating?: WorkoutRating) => {
    setIsSubmittingRating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Use provided scheduledDate or fallback to today in local timezone
      let scheduledDate = scheduledDateProp
      if (!scheduledDate) {
        const now = new Date()
        scheduledDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      }
      
      // Complete the workout
      const response = await fetch('/api/workouts/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutId,
          clientProgramId,
          scheduledDate
        })
      })

      if (!response.ok) {
        throw new Error('Failed to complete workout')
      }

      // Save rating to workout_logs if provided
      if (rating && (rating.rating > 0 || rating.difficulty || rating.notes)) {
        // Find the workout_log for this workout using the same scheduledDate
        const { data: workoutLog } = await supabase
          .from('workout_logs')
          .select('id')
          .eq('client_id', user.id)
          .eq('workout_id', workoutId)
          .eq('scheduled_date', scheduledDate)
          .order('completed_at', { ascending: false })
          .limit(1)
          .single()

        if (workoutLog) {
          // Update existing log with rating info
          await supabase
            .from('workout_logs')
            .update({
              rating: rating.rating > 0 ? rating.rating : null,
              difficulty: rating.difficulty,
              notes: rating.notes || null
            })
            .eq('id', workoutLog.id)
        } else {
          // Create new workout_log with rating
          await supabase
            .from('workout_logs')
            .insert({
              client_id: user.id,
              workout_id: workoutId,
              completed_at: new Date().toISOString(),
              scheduled_date: scheduledDate,
              rating: rating.rating > 0 ? rating.rating : null,
              difficulty: rating.difficulty,
              notes: rating.notes || null
            })
        }
      }

      setIsCompleted(true)
      setShowRatingModal(false)
      
      setTimeout(() => {
        router.push('/dashboard?completed=true')
      }, 1500)
    } catch (error) {
      console.error('Failed to complete workout:', error)
    } finally {
      setIsSubmittingRating(false)
      setIsLoading(false)
    }
  }

  const handleRatingSubmit = (rating: WorkoutRating) => {
    submitWorkoutCompletion(rating)
  }

  const handleSkipRating = () => {
    submitWorkoutCompletion()
  }

  if (isCompleted) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-40">
        <div className="bg-green-500 text-white py-4 px-6 rounded-2xl text-center font-semibold flex items-center justify-center gap-2">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Workout Complete!
        </div>
      </div>
    )
  }

  return (
    <>
      <div 
        className={`fixed bottom-20 left-4 right-4 z-40 transition-all duration-300 ${
          isVisible 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <button
          onClick={handleComplete}
          disabled={isLoading}
          className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-400/50 text-black py-4 px-6 rounded-2xl font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-yellow-400/20"
        >
          {isLoading ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Completing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Complete Workout
            </>
          )}
        </button>
      </div>
      
      {/* Rating Modal */}
      {showRatingModal && (
        <WorkoutRatingModal
          onSubmit={handleRatingSubmit}
          onSkip={handleSkipRating}
          isSubmitting={isSubmittingRating}
        />
      )}
    </>
  )
}
