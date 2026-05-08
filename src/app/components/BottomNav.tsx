'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Utensils, Dumbbell } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()

  const isHomeActive = pathname === '/dashboard' || pathname === '/'
  const isNutritionActive = pathname === '/nutrition' || pathname.startsWith('/nutrition/')

  // Restored FAB-style yellow center button (popping above the bar).
  // The user's complaint wasn't the FAB itself — it was the big visual
  // gap below the icons on iPhones with the home indicator. Fixed by
  // tightening the safe-area-bottom: full env(safe-area-inset-bottom)
  // (~34px) created a huge dead space below the icons. Subtract ~12px
  // so icons sit closer to the screen bottom while keeping clearance
  // for the home indicator gesture.
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-800 z-40">
      <div
        className="flex justify-around items-center h-16 max-w-lg mx-auto px-6"
        style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom) - 0.75rem), 0.25rem)' }}
      >
        {/* Home - Left */}
        <Link
          href="/dashboard"
          className={`flex flex-col items-center justify-center py-2 px-4 rounded-lg transition-all tap-target active:scale-95 ${
            isHomeActive ? 'text-yellow-400' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Home</span>
        </Link>

        {/* Today's Workout - Center (FAB-style, pops above the nav) */}
        <Link
          href="/workout/today"
          className="flex items-center justify-center -mt-7 transition-all active:scale-90"
          aria-label="Today's workout"
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-yellow-400/30 bg-yellow-400 text-black border-4 border-zinc-900 transition-transform">
            <Dumbbell className="w-6 h-6" />
          </div>
        </Link>

        {/* Nutrition - Right */}
        <Link
          href="/nutrition"
          className={`flex flex-col items-center justify-center py-2 px-4 rounded-lg transition-all tap-target active:scale-95 ${
            isNutritionActive ? 'text-yellow-400' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <Utensils className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Nutrition</span>
        </Link>
      </div>
    </nav>
  )
}
