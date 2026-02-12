'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SlideOutMenu, HamburgerButton } from './SlideOutMenu'
import { ChevronLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  showBack?: boolean
  backHref?: string
  rightElement?: React.ReactNode
}

export default function PageHeader({ title, showBack, backHref, rightElement }: PageHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()

  const handleBack = () => {
    if (backHref) {
      router.push(backHref)
    } else {
      router.back()
    }
  }

  return (
    <>
      <SlideOutMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Left - Hamburger or Back */}
          <div className="w-10">
            {showBack ? (
              <button
                onClick={handleBack}
                className="p-2 text-yellow-400 hover:text-yellow-300 transition-colors -ml-2"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : (
              <HamburgerButton onClick={() => setMenuOpen(true)} />
            )}
          </div>
          
          {/* Center - Title */}
          <h1 className="text-white font-semibold text-lg">{title}</h1>
          
          {/* Right - Custom element or spacer */}
          <div className="w-10 flex justify-end">
            {rightElement}
          </div>
        </div>
      </header>
    </>
  )
}
