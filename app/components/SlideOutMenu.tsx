'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Home, Dumbbell, Calendar, TrendingUp, Settings, HelpCircle, Instagram, ClipboardList } from 'lucide-react'

interface SlideOutMenuProps {
  isOpen: boolean
  onClose: () => void
}

const menuItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/log', label: 'Workout Log', icon: ClipboardList },
  { href: '/programs', label: 'Programs', icon: Dumbbell },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
]

const bottomItems = [
  { href: '/profile', label: 'Settings', icon: Settings },
  { href: 'mailto:support@compound.com', label: 'Contact Support', icon: HelpCircle, external: true },
  { href: 'https://www.instagram.com/eddytrains/', label: 'Follow on Instagram', icon: Instagram, external: true },
]

export function SlideOutMenu({ isOpen, onClose }: SlideOutMenuProps) {
  const pathname = usePathname()

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className={`fixed top-0 left-0 h-full w-72 bg-zinc-900 border-r border-zinc-800 z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center">
              <span className="text-black font-bold text-lg">E</span>
            </div>
            <div>
              <span className="text-white font-semibold block">eddytrains</span>
              <span className="text-zinc-500 text-[10px]">Powered by CMPD</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Main Navigation */}
        <nav className="p-3 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive 
                    ? 'bg-yellow-400/10 text-yellow-400' 
                    : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>
        
        {/* Divider */}
        <div className="mx-4 my-2 border-t border-zinc-800" />
        
        {/* Bottom Items */}
        <nav className="p-3 space-y-1">
          {bottomItems.map((item) => {
            const Icon = item.icon
            if (item.external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </a>
              )
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}

// Hamburger button component to use in headers
export function HamburgerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2 text-zinc-400 hover:text-white transition-colors"
      aria-label="Open menu"
    >
      <Menu className="w-6 h-6" />
    </button>
  )
}
