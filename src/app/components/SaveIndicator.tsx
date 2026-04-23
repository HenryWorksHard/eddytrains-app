'use client'

interface SaveIndicatorProps {
  /** true while a save is in flight (kept for back-compat, unused visually) */
  saving?: boolean
  /** Set when a save has failed; surfaces a red banner so the user knows. */
  error?: boolean
  /** Set during a recovery save (e.g., on pageshow / network reconnect). */
  recovering?: boolean
  /** CSS classes for positioning (e.g., "fixed bottom-20 right-4") */
  className?: string
}

/**
 * Floating save status pill.
 *
 * Originally this flashed "Saving..." → "Saved" on every set update, which
 * meant a typical workout (30+ sets) flickered the chip 30+ times. The
 * autosave loop is reliable and debounced, so silence is the right default.
 *
 * Now we only render when:
 *   - `error` is set: red banner so the client knows their last set didn't
 *     persist and they should check connectivity.
 *   - `recovering` is set: subtle indicator while a pageshow / reconnect
 *     triggered re-save is in flight.
 *
 * The `saving` prop is preserved (and accepted) so existing callers don't
 * break, but it deliberately produces no UI on its own.
 */
export default function SaveIndicator({ error, recovering, className = '' }: SaveIndicatorProps) {
  if (error) {
    return (
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400 ${className}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.33 16a2 2 0 001.74 3z" />
        </svg>
        Save failed — check connection
      </div>
    )
  }

  if (recovering) {
    return (
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 ${className}`}
      >
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Syncing...
      </div>
    )
  }

  return null
}
