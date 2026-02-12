'use client'

import { useEffect, useState } from 'react'
import { Trophy, X } from 'lucide-react'

interface PRCelebrationProps {
  isOpen: boolean
  onClose: () => void
  exerciseName: string
  weight: number
  reps: number
  previousBest?: { weight: number; reps: number }
}

export default function PRCelebration({
  isOpen,
  onClose,
  exerciseName,
  weight,
  reps,
  previousBest
}: PRCelebrationProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShow(true)
      // Auto-close after 3 seconds
      const timer = setTimeout(() => {
        setShow(false)
        setTimeout(onClose, 300)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  if (!isOpen && !show) return null

  const improvement = previousBest 
    ? weight - previousBest.weight 
    : weight

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Content */}
      <div className={`relative bg-gradient-to-b from-yellow-500/20 to-zinc-900 border border-yellow-500/30 rounded-3xl p-6 max-w-sm mx-4 text-center transform transition-transform duration-300 ${show ? 'scale-100' : 'scale-95'}`}>
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-zinc-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Trophy icon with glow */}
        <div className="w-20 h-20 bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Trophy className="w-10 h-10 text-yellow-400" />
        </div>
        
        {/* Title */}
        <h2 className="text-2xl font-bold text-yellow-400 mb-2">
          🎉 New PR!
        </h2>
        
        {/* Exercise name */}
        <p className="text-white font-semibold text-lg mb-4">
          {exerciseName}
        </p>
        
        {/* New record */}
        <div className="bg-zinc-800/50 rounded-xl p-4 mb-4">
          <div className="text-3xl font-bold text-white">
            {weight}<span className="text-lg text-zinc-400">kg</span>
            <span className="mx-2 text-zinc-500">×</span>
            {reps}<span className="text-lg text-zinc-400">reps</span>
          </div>
          
          {previousBest && improvement > 0 && (
            <p className="text-green-400 text-sm mt-2">
              +{improvement}kg from previous best!
            </p>
          )}
        </div>
        
        {/* Motivational message */}
        <p className="text-zinc-400 text-sm">
          Keep pushing! Every PR is progress! 💪
        </p>
      </div>
      
      {/* Confetti effect using CSS */}
      <style jsx>{`
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
