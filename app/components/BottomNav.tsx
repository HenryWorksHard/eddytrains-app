'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/programs', label: 'Programs', icon: '💪' },
  { href: '/schedule', label: 'Schedule', icon: '📅' },
  { href: '/profile', label: 'Profile', icon: '👤' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-800 z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-4 pb-safe">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-2 px-4 rounded-xl transition-colors ${
                isActive 
                  ? 'text-yellow-400' 
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              <span className="text-xl mb-1">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
