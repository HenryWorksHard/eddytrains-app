'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Check } from 'lucide-react'

interface WheelPickerProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (weight: number | null, reps: number | null) => void
  initialWeight?: number | null
  initialReps?: number | null
  targetReps?: string // e.g., "8-12" or "10"
  suggestedWeight?: number | null
  exerciseName?: string
  setNumber?: number
}

// Single column picker component
function PickerColumn({
  values,
  selectedIndex,
  onSelect,
  label,
  unit
}: {
  values: (number | string)[]
  selectedIndex: number
  onSelect: (index: number) => void
  label: string
  unit?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemHeight = 44 // Height of each item in px
  const visibleItems = 5 // Number of visible items
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>(null)

  // Scroll to selected index on mount and when selection changes
  useEffect(() => {
    if (containerRef.current && !isScrolling) {
      const scrollTop = selectedIndex * itemHeight
      containerRef.current.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      })
    }
  }, [selectedIndex, isScrolling])

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    
    setIsScrolling(true)
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    
    // Debounce scroll end detection
    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return
      
      const scrollTop = containerRef.current.scrollTop
      const newIndex = Math.round(scrollTop / itemHeight)
      const clampedIndex = Math.max(0, Math.min(values.length - 1, newIndex))
      
      // Snap to nearest item
      containerRef.current.scrollTo({
        top: clampedIndex * itemHeight,
        behavior: 'smooth'
      })
      
      onSelect(clampedIndex)
      setIsScrolling(false)
    }, 100)
  }, [values.length, itemHeight, onSelect])

  return (
    <div className="flex-1 flex flex-col items-center">
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">{label}</div>
      
      <div className="relative w-full">
        {/* Selection indicator */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-11 bg-zinc-800 rounded-xl pointer-events-none z-0" />
        
        {/* Gradient overlays */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-zinc-900 to-transparent pointer-events-none z-10" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none z-10" />
        
        {/* Scrollable container */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="relative overflow-y-auto scrollbar-hide snap-y snap-mandatory"
          style={{
            height: itemHeight * visibleItems,
            paddingTop: itemHeight * 2,
            paddingBottom: itemHeight * 2,
          }}
        >
          {values.map((value, index) => {
            const isSelected = index === selectedIndex
            const distance = Math.abs(index - selectedIndex)
            const opacity = isSelected ? 1 : distance === 1 ? 0.5 : 0.25
            
            return (
              <div
                key={index}
                onClick={() => {
                  onSelect(index)
                  if (containerRef.current) {
                    containerRef.current.scrollTo({
                      top: index * itemHeight,
                      behavior: 'smooth'
                    })
                  }
                }}
                className="flex items-center justify-center snap-center cursor-pointer transition-all duration-150"
                style={{
                  height: itemHeight,
                  opacity,
                  transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                <span className={`text-xl font-semibold ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
                  {value}
                  {unit && isSelected && <span className="text-sm ml-1 text-zinc-400">{unit}</span>}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function WheelPicker({
  isOpen,
  onClose,
  onConfirm,
  initialWeight,
  initialReps,
  targetReps,
  suggestedWeight,
  exerciseName,
  setNumber
}: WheelPickerProps) {
  // Generate weight values (0-200 in 0.5 increments, plus common plates)
  const weightValues = Array.from({ length: 401 }, (_, i) => (i * 0.5).toFixed(1))
  
  // Generate reps values (0-50)
  const repsValues = Array.from({ length: 51 }, (_, i) => i)
  
  // Find initial indices
  const getWeightIndex = (weight: number | null | undefined): number => {
    if (weight === null || weight === undefined) {
      // Default to suggested weight or 20kg
      const defaultWeight = suggestedWeight ?? 20
      return Math.round(defaultWeight * 2)
    }
    return Math.round(weight * 2)
  }
  
  const getRepsIndex = (reps: number | null | undefined): number => {
    if (reps === null || reps === undefined) {
      // Default to target reps (first number if range) or 10
      if (targetReps) {
        const match = targetReps.match(/^(\d+)/)
        if (match) return parseInt(match[1])
      }
      return 10
    }
    return reps
  }
  
  const [weightIndex, setWeightIndex] = useState(getWeightIndex(initialWeight))
  const [repsIndex, setRepsIndex] = useState(getRepsIndex(initialReps))
  
  // Reset when opened with new values
  useEffect(() => {
    if (isOpen) {
      setWeightIndex(getWeightIndex(initialWeight))
      setRepsIndex(getRepsIndex(initialReps))
    }
  }, [isOpen, initialWeight, initialReps])
  
  if (!isOpen) return null
  
  const handleConfirm = () => {
    const weight = parseFloat(weightValues[weightIndex])
    const reps = repsValues[repsIndex]
    onConfirm(weight, reps)
    onClose()
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div className="relative w-full max-w-md bg-zinc-900 rounded-t-3xl border-t border-zinc-700 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <button 
            onClick={onClose}
            className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            {exerciseName && (
              <h3 className="text-white font-semibold truncate max-w-[200px]">{exerciseName}</h3>
            )}
            {setNumber && (
              <p className="text-zinc-500 text-sm">Set {setNumber}</p>
            )}
          </div>
          
          <button 
            onClick={handleConfirm}
            className="p-2 -mr-2 text-yellow-400 hover:text-yellow-300 transition-colors"
          >
            <Check className="w-6 h-6" />
          </button>
        </div>
        
        {/* Target info */}
        {(targetReps || suggestedWeight) && (
          <div className="flex justify-center gap-4 py-3 text-sm border-b border-zinc-800/50">
            {suggestedWeight && (
              <span className="text-zinc-400">
                Suggested: <span className="text-green-400 font-medium">{suggestedWeight}kg</span>
              </span>
            )}
            {targetReps && (
              <span className="text-zinc-400">
                Target: <span className="text-yellow-400 font-medium">{targetReps} reps</span>
              </span>
            )}
          </div>
        )}
        
        {/* Wheel Pickers */}
        <div className="flex gap-4 px-6 py-6">
          <PickerColumn
            values={weightValues}
            selectedIndex={weightIndex}
            onSelect={setWeightIndex}
            label="Weight"
            unit="kg"
          />
          <PickerColumn
            values={repsValues}
            selectedIndex={repsIndex}
            onSelect={setRepsIndex}
            label="Reps"
          />
        </div>
        
        {/* Confirm Button */}
        <div className="p-4 pb-8">
          <button
            onClick={handleConfirm}
            className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-2xl transition-colors text-lg"
          >
            Log Set
          </button>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}
