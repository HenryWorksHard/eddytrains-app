'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Check } from 'lucide-react'

interface WheelPickerProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (weight: number | null, reps: number | null) => void
  initialWeight?: number | null
  initialReps?: number | null
  targetReps?: string
  suggestedWeight?: number | null
  exerciseName?: string
  setNumber?: number
}

// Single column picker component - COMPACT VERSION
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
  const itemHeight = 36 // Smaller item height
  const visibleItems = 5
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>(null)

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
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return
      
      const scrollTop = containerRef.current.scrollTop
      const newIndex = Math.round(scrollTop / itemHeight)
      const clampedIndex = Math.max(0, Math.min(values.length - 1, newIndex))
      
      containerRef.current.scrollTo({
        top: clampedIndex * itemHeight,
        behavior: 'smooth'
      })
      
      onSelect(clampedIndex)
      setIsScrolling(false)
    }, 80)
  }, [values.length, itemHeight, onSelect])

  return (
    <div className="flex-1 flex flex-col items-center">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
      
      <div className="relative w-full">
        {/* Selection indicator */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-9 bg-zinc-800 rounded-lg pointer-events-none z-0" />
        
        {/* Gradient overlays */}
        <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-zinc-900 to-transparent pointer-events-none z-10" />
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none z-10" />
        
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
            const opacity = isSelected ? 1 : distance === 1 ? 0.5 : 0.2
            
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
                  transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                <span className={`text-base font-semibold ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
                  {value}
                  {unit && isSelected && <span className="text-xs ml-0.5 text-zinc-400">{unit}</span>}
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
  // Weight values (0-200 in 0.5 increments)
  const weightValues = Array.from({ length: 401 }, (_, i) => (i * 0.5).toFixed(1))
  
  // Reps values (0-50)
  const repsValues = Array.from({ length: 51 }, (_, i) => i)
  
  const getWeightIndex = (weight: number | null | undefined): number => {
    if (weight === null || weight === undefined) {
      const defaultWeight = suggestedWeight ?? 20
      return Math.round(defaultWeight * 2)
    }
    return Math.round(weight * 2)
  }
  
  const getRepsIndex = (reps: number | null | undefined): number => {
    if (reps === null || reps === undefined) {
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
  
  useEffect(() => {
    if (isOpen) {
      setWeightIndex(getWeightIndex(initialWeight))
      setRepsIndex(getRepsIndex(initialReps))
    }
  }, [isOpen, initialWeight, initialReps, suggestedWeight, targetReps])
  
  if (!isOpen) return null
  
  const handleConfirm = () => {
    const weight = parseFloat(weightValues[weightIndex])
    const reps = repsValues[repsIndex]
    onConfirm(weight, reps)
    onClose()
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Centered Modal - Compact */}
      <div className="relative w-full max-w-[280px] bg-zinc-900 rounded-2xl border border-zinc-700 shadow-xl animate-scale-in">
        {/* Header - Compact */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <button 
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="text-center flex-1 mx-2">
            {exerciseName && (
              <h3 className="text-white font-semibold text-sm truncate">{exerciseName}</h3>
            )}
            {setNumber && (
              <p className="text-zinc-500 text-xs">Set {setNumber}</p>
            )}
          </div>
          
          <button 
            onClick={handleConfirm}
            className="p-1.5 text-yellow-400 hover:text-yellow-300 transition-colors"
          >
            <Check className="w-5 h-5" />
          </button>
        </div>
        
        {/* Target info - Compact */}
        {targetReps && (
          <div className="text-center py-1.5 text-xs border-b border-zinc-800/50">
            <span className="text-zinc-400">Target: </span>
            <span className="text-yellow-400 font-medium">{targetReps} reps</span>
          </div>
        )}
        
        {/* Wheel Pickers - Compact */}
        <div className="flex gap-2 px-4 py-4">
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
        
        {/* Confirm Button - Compact */}
        <div className="px-4 pb-4">
          <button
            onClick={handleConfirm}
            className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 active:bg-yellow-600 text-black font-bold rounded-xl transition-colors text-sm"
          >
            Log Set
          </button>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
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
