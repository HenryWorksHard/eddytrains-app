'use client'

import { useEffect, useState } from 'react'

interface GreetingHeaderProps {
  userName: string
  streak?: number
}

export default function GreetingHeader({ userName, streak = 0 }: GreetingHeaderProps) {
  const [greeting, setGreeting] = useState('Hello')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Get user's local hour
    const hour = new Date().getHours()
    
    if (hour >= 5 && hour < 12) {
      setGreeting('Good morning')
    } else if (hour >= 12 && hour < 17) {
      setGreeting('Good afternoon')
    } else if (hour >= 17 && hour < 21) {
      setGreeting('Good evening')
    } else {
      setGreeting('Good night')
    }
  }, [])

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          Hello, {userName?.split(' ')[0] || 'there'}
        </h1>
        {streak > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full">
              <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
              </svg>
              <span className="text-orange-400 font-semibold text-sm">{streak} day streak</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-white">
        {greeting}, {userName?.split(' ')[0] || 'there'}
      </h1>
      {streak > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full">
            <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
            </svg>
            <span className="text-orange-400 font-semibold text-sm">{streak} day streak</span>
          </div>
        </div>
      )}
    </div>
  )
}
