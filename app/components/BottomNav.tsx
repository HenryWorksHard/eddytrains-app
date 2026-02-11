'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Utensils, Dumbbell } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()

  const isProfileActive = pathname === '/profile' || pathname.startsWith('/profile/')
  const isNutritionActive = pathname === '/nutrition' || pathname.startsWith('/nutrition/')
  const isWorkoutActive = pathname.startsWith('/workout') || pathname === '/dashboard'

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-800 z-40 safe-area-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-6">
        {/* Profile - Left */}
        <Link
          href="/profile"
          className={`flex flex-col items-center justify-center py-1 px-4 rounded-lg transition-colors ${
            isProfileActive 
              ? 'text-yellow-400' 
              : 'text-zinc-500 hover:text-white'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-1">Profile</span>
        </Link>

        {/* Today's Workout - Center (Prominent) */}
        <Link
          href="/dashboard"
          className={`flex items-center justify-center -mt-4 transition-transform active:scale-95`}
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ${
            isWorkoutActive 
              ? 'bg-yellow-400 text-black' 
              : 'bg-yellow-400 text-black'
          }`}>
            <Dumbbell className="w-6 h-6" />
          </div>
        </Link>

        {/* Nutrition - Right */}
        <Link
          href="/nutrition"
          className={`flex flex-col items-center justify-center py-1 px-4 rounded-lg transition-colors ${
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
