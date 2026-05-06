'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Utensils, Dumbbell } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()

  const isHomeActive = pathname === '/dashboard' || pathname === '/'
  const isNutritionActive = pathname === '/nutrition' || pathname.startsWith('/nutrition/')

  // Explicit pt + pb on the inner row instead of a fixed h-16 + safe-area
  // padding on the outer <nav>. The previous setup centered icons inside
  // h-16 then added safe-area padding below, which on iPhones with a home
  // indicator made the icons sit awkwardly high and the yellow center
  // button feel cramped against the home indicator. Now the safe-area
  // value is added to the inner padding directly, so icons and the
  // popped-up center button are vertically balanced regardless of device.
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-800 z-40">
      <div
        className="flex justify-around items-center max-w-lg mx-auto px-6 pt-2"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        {/* Home - Left */}
        <Link
          href="/dashboard"
          className={`flex flex-col items-center justify-center py-2 px-4 rounded-lg transition-all tap-target active:scale-95 ${
            isHomeActive
              ? 'text-yellow-400'
              : 'text-zinc-500 hover:text-white'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Home</span>
        </Link>

        {/* Today's Workout - Center (Prominent FAB-style, pops above the nav) */}
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
            isNutritionActive
              ? 'text-yellow-400'
              : 'text-zinc-500 hover:text-white'
          }`}
        >
          <Utensils className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Nutrition</span>
        </Link>
      </div>
    </nav>
  )
}
