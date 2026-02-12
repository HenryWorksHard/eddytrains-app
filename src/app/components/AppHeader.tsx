'use client'

import { useState } from 'react'
import { SlideOutMenu, HamburgerButton } from './SlideOutMenu'

interface AppHeaderProps {
  title?: string
  showBack?: boolean
  onBack?: () => void
  rightElement?: React.ReactNode
}

export default function AppHeader({ title, showBack, onBack, rightElement }: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 bg-zinc-900/95 backdrop-blur-lg border-b border-zinc-800 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Left - Hamburger or Back */}
          <div className="w-10">
            {showBack ? (
              <button
                onClick={onBack}
                className="p-2 text-yellow-400 hover:text-yellow-300 transition-colors -ml-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <HamburgerButton onClick={() => setMenuOpen(true)} />
            )}
          </div>
          
          {/* Center - Title */}
          {title && (
            <h1 className="text-white font-semibold text-lg">{title}</h1>
          )}
          
          {/* Right - Custom element or spacer */}
          <div className="w-10 flex justify-end">
            {rightElement}
          </div>
        </div>
      </header>

      <SlideOutMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}
