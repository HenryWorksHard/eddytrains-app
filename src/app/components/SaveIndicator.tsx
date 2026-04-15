'use client'

import { useState, useEffect, useRef } from 'react'

interface SaveIndicatorProps {
  /** true while a save is in flight */
  saving: boolean
  /** CSS classes for positioning (e.g., "fixed bottom-20 right-4") */
  className?: string
}

/**
 * A small floating indicator that shows "Saving..." while a save is in
 * progress and "Saved" for a couple of seconds after it completes. Fades
 * out automatically so it's unobtrusive once the user knows it worked.
 */
export default function SaveIndicator({ saving, className = '' }: SaveIndicatorProps) {
  const [visible, setVisible] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasSaving = useRef(false)

  useEffect(() => {
    // Started saving
    if (saving) {
      wasSaving.current = true
      setVisible(true)
      setJustSaved(false)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }

    // Finished saving (transition from true → false)
    if (!saving && wasSaving.current) {
      wasSaving.current = false
      setJustSaved(true)
      // Stay visible for 2 seconds after saving, then fade out
      hideTimer.current = setTimeout(() => {
        setVisible(false)
        setJustSaved(false)
      }, 2000)
    }

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [saving])

  if (!visible) return null

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-opacity duration-500 ${
        justSaved
          ? 'bg-green-500/15 text-green-400'
          : 'bg-zinc-800 text-zinc-400'
      } ${className}`}
    >
      {justSaved ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Saved
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Saving...
        </>
      )}
    </div>
  )
}
