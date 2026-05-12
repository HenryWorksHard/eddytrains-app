'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Utensils, Dumbbell } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()

  const isHomeActive = pathname === '/dashboard' || pathname === '/'
  const isNutritionActive = pathname === '/nutrition' || pathname.startsWith('/nutrition/')

  // The "big gap below the icons" Louis sees comes from two stacked
  // sources of dead space:
  //   1. h-16 (64px) inner box + items-center → icons are vertically
  //      centered, leaving ~14px of empty space inside h-16 below them.
  //   2. paddingBottom for the safe-area inset (~34px on iPhone).
  // Combined that's ~48px of empty bar below the icons before the
  // screen edge.
  //
  // Fix: drop h-16 so the bar sizes to its content. Trim padding-bottom
  // further (safe-area minus 1rem) so the home-indicator gesture area
  // still clears (~14-18px on iPhone) but the icons hug the screen.
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-800 z-40">
      <div
        className="flex justify-around items-center max-w-lg mx-auto px-6 pt-1"
        style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom) - 1rem), 0.25rem)' }}
      >
        {/* Home - Left */}
        <Link
          href="/dashboard"
          className={`flex flex-col items-center justify-center py-1 px-4 rounded-lg transition-all tap-target active:scale-95 ${
            isHomeActive ? 'text-yellow-400' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Home</span>
        </Link>

        {/* Today's Workout - Center (FAB-style, pops above the nav) */}
        <Link
          href="/workout/today"
          className="flex items-center justify-center -mt-6 transition-all active:scale-90"
          aria-label="Today's workout"
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-yellow-400/30 bg-yellow-400 text-black border-4 border-zinc-900 transition-transform">
            <Dumbbell className="w-6 h-6" />
          </div>
        </Link>

        {/* Nutrition - Right */}
        <Link
          href="/nutrition"
          className={`flex flex-col items-center justify-center py-1 px-4 rounded-lg transition-all tap-target active:scale-95 ${
            isNutritionActive ? 'text-yellow-400' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <Utensils className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Nutrition</span>
        </Link>
      </div>
    </nav>
  )
}
