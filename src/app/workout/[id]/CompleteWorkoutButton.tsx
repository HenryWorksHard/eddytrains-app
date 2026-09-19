'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Star, X } from 'lucide-react'
import { mutate } from 'swr'
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
  isSubmitting,
  isFirstRating,
}: {
  onSubmit: (rating: WorkoutRating) => void
  onSkip: () => void
  isSubmitting: boolean
  isFirstRating: boolean
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
          {isFirstRating && (
            <p className="text-zinc-400 text-xs mt-2 italic">
              Your coach uses this to adjust your next session.
            </p>
          )}
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

// Full-screen blocking overlay shown while /api/workouts/complete is in
// flight. Prevents users from exiting the app mid-save (the top failure
// mode observed in diagnostic data: users tapped Complete then swiped out
// before the ~1-3s async chain finished, leaving the completion record
// unwritten). No close button — the modal is intentionally undismissable
// until the save completes or errors out.
function SavingWorkoutOverlay({ label }: { label: string }) {
  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[60] flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      // Block scroll + touch — belt-and-braces on top of the backdrop.
      style={{ touchAction: 'none' }}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-xs w-full text-center">
        <div className="w-14 h-14 mx-auto mb-4 relative">
          <div className="absolute inset-0 rounded-full border-4 border-zinc-800" />
          <div className="absolute inset-0 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin" />
        </div>
        <h2 className="text-white text-lg font-semibold mb-1">Saving your workout</h2>
        <p className="text-zinc-500 text-sm leading-relaxed">
          {label}
        </p>
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
  const [optimisticComplete, setOptimisticComplete] = useState(false)
  const [optimisticError, setOptimisticError] = useState<string | null>(null)
  const [isFirstRating, setIsFirstRating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)
  // Full-screen "Saving your workout" overlay. Shown from the moment the
  // user taps Done on the rating modal until the completion POST resolves.
  // Blocks accidental exit-mid-save — the top failure mode confirmed by
  // diagnostic events (bd2c6c6d had 21 pending rows when tapping Complete,
  // sets landed but is_completed sometimes stayed false because the user
  // exited before the /api/workouts/complete POST returned).
  const [showSavingOverlay, setShowSavingOverlay] = useState(false)
  const [savingLabel, setSavingLabel] = useState('Just a moment...')
  // True between the moment a fresh completion lands and the dashboard
  // navigation firing. Keeps the green "Completed" pill visible across
  // that window so the UI doesn't flash through the gray "Update Workout"
  // state on its way home.
  const [navigatingHome, setNavigatingHome] = useState(false)
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

  // The completion is sent the moment Complete is tapped — NOT after the
  // rating. Previously nothing was sent, not even the backgrounding beacon,
  // until the client picked a rating and tapped Done or Skip. Tap Complete,
  // see "How was it?", lock the phone: every set was saved but the workout
  // was never marked complete, so the week showed it as missed. (Chris,
  // 19 Sep 2026: 18 sets saved across all six exercises, no completion.)
  // The rating is optional metadata; it now follows the completion rather
  // than gating it.
  const completionRef = useRef<Promise<boolean> | null>(null)

  // scheduledDateProp is the authoritative source; fall back to local
  // "today" only when the parent didn't provide one (rare).
  const resolveScheduledDate = () => {
    if (scheduledDateProp) return scheduledDateProp
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }

  const startCompletion = (): Promise<boolean> => {
    if (completionRef.current) return completionRef.current

    // Build the payload SYNCHRONOUSLY, before any await, so a swipe-out on
    // the very first frame still has something for the beacon to send.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const completionPayload = JSON.stringify({
      workoutId,
      clientProgramId,
      scheduledDate: resolveScheduledDate(),
      tz,
    })

    let beaconSent = false
    const sendCompletionBeacon = () => {
      if (beaconSent || typeof navigator === 'undefined' || !navigator.sendBeacon) return
      try {
        const blob = new Blob([completionPayload], { type: 'application/json' })
        if (navigator.sendBeacon('/api/workouts/complete', blob)) beaconSent = true
      } catch (e) {
        console.warn('[CompleteWorkout] beacon send failed:', e)
      }
    }
    const onHiddenBeacon = () => {
      if (document.visibilityState === 'hidden') sendCompletionBeacon()
    }
    // Registered now, while the rating modal is still on screen, so leaving
    // the app from the modal still lands the completion.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onHiddenBeacon)
      window.addEventListener('pagehide', sendCompletionBeacon)
    }

    const run = (async () => {
      try {
        // Flush pending set autosaves first so the last set's debounce
        // can't lose a race with the completion (Halley bug, 2026-06-29).
        // The flush is capped internally, so it can't block completion.
        const flushFn = (window as unknown as { __cmpdFlushWorkoutSaves?: () => Promise<void> }).__cmpdFlushWorkoutSaves
        if (flushFn) {
          try {
            await flushFn()
          } catch (e) {
            console.warn('[CompleteWorkout] flush before complete failed (continuing):', e)
          }
        }

        // keepalive lets the fetch survive the page going away; combined
        // with the beacon that's two independent routes for the write.
        const response = await fetch('/api/workouts/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: completionPayload,
        })
        if (!response.ok) throw new Error('Failed to complete workout')

        // Push the updated Pascal score into SWR and force the dashboard to
        // refetch, so today's completion shows the moment they land there.
        try {
          const result = await response.clone().json()
          if (result?.pascal) {
            mutate(`/api/pascal?tz=${encodeURIComponent(tz)}`, result.pascal, false)
          }
        } catch {
          // Response may not be JSON in edge failure modes; ignore.
        }
        mutate((key) => typeof key === 'string' && key.startsWith('/api/dashboard'))
        return true
      } catch (error) {
        console.error('Failed to complete workout:', error)
        // Last-ditch: if iOS killed the fetch, the beacon may still land it.
        sendCompletionBeacon()
        return false
      } finally {
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', onHiddenBeacon)
          window.removeEventListener('pagehide', sendCompletionBeacon)
        }
      }
    })()

    completionRef.current = run
    return run
  }

  const handleComplete = () => {
    if (isCompleted || isLoading) return
    // One-time explainer under the "How was it?" copy so clients
    // understand what the rating is used for the first time they see it.
    try {
      const key = 'cmpd:rated-workout'
      if (!localStorage.getItem(key)) {
        setIsFirstRating(true)
        localStorage.setItem(key, '1')
      }
    } catch {
      // localStorage unavailable — skip the explainer
    }
    startCompletion()
    setShowRatingModal(true)
  }

  const submitWorkoutCompletion = async (rating?: WorkoutRating) => {
    setIsSubmittingRating(true)
    setSavingLabel('Saving your workout...')
    setShowSavingOverlay(true)
    // Flip to the green "Completed" pill straight away; reverted below if
    // the completion turns out to have failed.
    setOptimisticComplete(true)
    setOptimisticError(null)

    // Usually already in flight (started on tap) or finished by now.
    const ok = await (completionRef.current ?? startCompletion())

    if (!ok) {
      // Clear it so tapping Complete again starts a fresh attempt.
      completionRef.current = null
      setOptimisticComplete(false)
      setOptimisticError("Couldn't save — tap to retry")
      setShowRatingModal(false)
      setShowSavingOverlay(false)
      setIsSubmittingRating(false)
      setIsLoading(false)
      return
    }

    // The workout is complete at this point. A failed rating write must
    // never undo that, so it's best-effort.
    if (rating && (rating.rating > 0 || rating.difficulty || rating.notes)) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const scheduledDate = resolveScheduledDate()
          const { data: workoutLog } = await supabase
            .from('workout_logs')
            .select('id')
            .eq('client_id', user.id)
            .eq('workout_id', workoutId)
            .eq('scheduled_date', scheduledDate)
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const ratingFields = {
            rating: rating.rating > 0 ? rating.rating : null,
            difficulty: rating.difficulty,
            notes: rating.notes || null,
          }

          if (workoutLog) {
            await supabase.from('workout_logs').update(ratingFields).eq('id', workoutLog.id)
          } else {
            await supabase.from('workout_logs').insert({
              client_id: user.id,
              workout_id: workoutId,
              completed_at: new Date().toISOString(),
              scheduled_date: scheduledDate,
              ...ratingFields,
            })
          }
        }
      } catch (e) {
        console.warn('[CompleteWorkout] rating save failed (workout still complete):', e)
      }
    }

    setIsCompleted(true)
    setShowRatingModal(false)
    setNavigatingHome(true)
    setShowSavingOverlay(false)
    setIsSubmittingRating(false)
    setIsLoading(false)

    setTimeout(() => {
      router.replace('/dashboard?completed=true')
    }, 600)
  }

  const handleRatingSubmit = (rating: WorkoutRating) => {
    submitWorkoutCompletion(rating)
  }

  const handleSkipRating = () => {
    submitWorkoutCompletion()
  }

  // For already-completed workouts, show "Update Workout" button.
  // Inline (not fixed) — sits centered after the last exercise card with
  // breathing room. Page wrapper has pb-nav so BottomNav clearance is OK.
  if (isCompleted && !showRatingModal && !navigatingHome) {
    return (
      <>
        <div className="px-4 mt-6 mb-8">
          <button
            onClick={async () => {
              // Trigger a save by dispatching a custom event that WorkoutClient listens to
              window.dispatchEvent(new CustomEvent('forceSaveWorkout'))
              // Show brief feedback
              const btn = document.getElementById('update-workout-btn')
              if (btn) {
                btn.textContent = 'Saved!'
                btn.classList.remove('bg-zinc-700')
                btn.classList.add('bg-green-500')
                setTimeout(() => {
                  btn.textContent = 'Update Workout'
                  btn.classList.remove('bg-green-500')
                  btn.classList.add('bg-zinc-700')
                }, 1500)
              }
            }}
            id="update-workout-btn"
            className="w-full bg-zinc-700 hover:bg-zinc-600 text-white py-4 px-6 rounded-2xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Update Workout
          </button>
        </div>
        {showSavingOverlay && <SavingWorkoutOverlay label={savingLabel} />}
      </>
    )
  }

  // Green "Completed" pill. Shown both during the optimistic window
  // (after tapping Done, before the network resolves) AND during the brief
  // post-success delay before we navigate the user home — so the UI never
  // flickers through the gray "Update Workout" state on the way out.
  if ((optimisticComplete && !isCompleted) || navigatingHome) {
    return (
      <>
        <div className="px-4 mt-6 mb-8">
          <button
            disabled
            className="w-full bg-green-500 text-black py-4 px-6 rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Completed
          </button>
        </div>
        {showSavingOverlay && <SavingWorkoutOverlay label={savingLabel} />}
      </>
    )
  }

  return (
    <>
      <div
        className={`px-4 mt-6 mb-8 transition-all duration-300 ${
          isVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {optimisticError && (
          <div className="mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg text-center">
            {optimisticError}
          </div>
        )}
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
          isFirstRating={isFirstRating}
        />
      )}

      {/* Full-screen "Saving your workout" overlay. Rendered at the top
          level (z-[60]) so it sits above the rating modal and any other
          in-flight UI. Undismissable — the user cannot exit until the
          save completes or errors out. */}
      {showSavingOverlay && <SavingWorkoutOverlay label={savingLabel} />}
    </>
  )
}
