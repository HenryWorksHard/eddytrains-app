'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface CompleteWorkoutButtonProps {
  workoutId: string
  clientProgramId?: string
  isCompleted?: boolean
}

export default function CompleteWorkoutButton({ 
  workoutId, 
  clientProgramId,
  isCompleted: initialCompleted = false 
}: CompleteWorkoutButtonProps) {
  const [isCompleted, setIsCompleted] = useState(initialCompleted)
  const [isLoading, setIsLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const router = useRouter()

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

  const handleComplete = async () => {
    if (isCompleted || isLoading) return
    
    setIsLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const response = await fetch('/api/workouts/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutId,
          clientProgramId,
          scheduledDate: today
        })
      })

      if (response.ok) {
        setIsCompleted(true)
        setTimeout(() => {
          router.push('/dashboard?completed=true')
        }, 1500)
      }
    } catch (error) {
      console.error('Failed to complete workout:', error)
    } finally {
      setIsLoading(false)
    }
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
  )
}
