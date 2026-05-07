'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Utensils, Dumbbell } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()

  const isHomeActive = pathname === '/dashboard' || pathname === '/'
  const isNutritionActive = pathname === '/nutrition' || pathname.startsWith('/nutrition/')

  const isWorkoutActive = pathname === '/workout/today' || pathname.startsWith('/workout/')

  // Flat 3-tab bar: all tabs at the same vertical level, equal width, with
  // labels. The middle "Train" tab is visually distinguished by a yellow
  // icon-container instead of popping up above the bar — the previous FAB
  // pop-up trick (-mt-7) felt disconnected from the bar on iPhone.
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-800 z-40">
      <div
        className="flex max-w-lg mx-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Home */}
        <Link
          href="/dashboard"
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors active:scale-95 tap-target ${
            isHomeActive ? 'text-yellow-400' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        {/* Today's Workout — middle tab, yellow icon container */}
        <Link
          href="/workout/today"
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-transform active:scale-95 tap-target"
          aria-label="Today's workout"
        >
          <div className="w-9 h-9 rounded-full bg-yellow-400 text-black flex items-center justify-center">
            <Dumbbell className="w-5 h-5" />
          </div>
          <span className={`text-[10px] font-medium ${isWorkoutActive ? 'text-yellow-400' : 'text-zinc-500'}`}>
            Train
          </span>
        </Link>

        {/* Nutrition */}
        <Link
          href="/nutrition"
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors active:scale-95 tap-target ${
            isNutritionActive ? 'text-yellow-400' : 'text-zinc-500 hover:text-white'
          }`}
        >
          <Utensils className="w-5 h-5" />
          <span className="text-[10px] font-medium">Nutrition</span>
        </Link>
      </div>
    </nav>
  )
}
