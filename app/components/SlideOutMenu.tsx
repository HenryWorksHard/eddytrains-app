'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Home, Dumbbell, Calendar, TrendingUp, Settings, HelpCircle, Instagram, Clock, ChevronRight } from 'lucide-react'
import { createClient } from '../lib/supabase/client'

interface SlideOutMenuProps {
  isOpen: boolean
  onClose: () => void
}

interface RecentWorkout {
  id: string
  workoutId: string
  workoutName: string
  programName: string
  completedAt: string
  scheduledDate: string
}

const menuItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/programs', label: 'Programs', icon: Dumbbell },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
]

const bottomItems = [
  { href: '/profile', label: 'Settings', icon: Settings, isSettings: true },
  { href: 'mailto:support@compound.com', label: 'Contact Support', icon: HelpCircle, external: true },
  { href: 'https://www.instagram.com/eddytrains/', label: 'Follow on Instagram', icon: Instagram, external: true },
]

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function SlideOutMenu({ isOpen, onClose }: SlideOutMenuProps) {
  const pathname = usePathname()
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([])
  const [loadingRecent, setLoadingRecent] = useState(false)
  const supabase = createClient()

  // Fetch recent workouts when menu opens
  useEffect(() => {
    if (isOpen && recentWorkouts.length === 0) {
      fetchRecentWorkouts()
    }
  }, [isOpen])

  const fetchRecentWorkouts = async () => {
    setLoadingRecent(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get recent completions with workout names
      const { data: completions } = await supabase
        .from('workout_completions')
        .select('id, workout_id, scheduled_date, completed_at, client_program_id')
        .eq('client_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(5)

      if (!completions || completions.length === 0) {
        setRecentWorkouts([])
        return
      }

      // Get workout names
      const workoutIds = [...new Set(completions.map(c => c.workout_id))]
      const { data: workouts } = await supabase
        .from('program_workouts')
        .select('id, name, program_id, programs(name)')
        .in('id', workoutIds)

      const workoutMap = new Map(workouts?.map(w => [w.id, w]) || [])

      const recent: RecentWorkout[] = completions.map(c => {
        const workout = workoutMap.get(c.workout_id)
        const programData = workout?.programs as { name: string } | { name: string }[] | null
        const programName = Array.isArray(programData) ? programData[0]?.name : programData?.name
        return {
          id: c.id,
          workoutId: c.workout_id,
          workoutName: workout?.name || 'Workout',
          programName: programName || 'Program',
          completedAt: c.completed_at,
          scheduledDate: c.scheduled_date
        }
      })

      setRecentWorkouts(recent)
    } catch (err) {
      console.error('Failed to fetch recent workouts:', err)
    } finally {
      setLoadingRecent(false)
    }
  }

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
        
        {/* Recent Workouts */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 px-4 py-2 text-zinc-500">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Recent Workouts</span>
          </div>
          
          {loadingRecent ? (
            <div className="px-4 py-3">
              <div className="h-4 bg-zinc-800 rounded animate-pulse" />
            </div>
          ) : recentWorkouts.length === 0 ? (
            <p className="px-4 py-2 text-zinc-600 text-sm">No completed workouts yet</p>
          ) : (
            <div className="space-y-1">
              {recentWorkouts.map((workout) => (
                <Link
                  key={workout.id}
                  href={`/workout/${workout.workoutId}`}
                  onClick={onClose}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{workout.workoutName}</p>
                    <p className="text-zinc-500 text-xs truncate">{formatRelativeTime(workout.completedAt)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0" />
                </Link>
              ))}
              
              {/* See All Link */}
              <Link
                href="/history"
                onClick={onClose}
                className="flex items-center justify-center gap-1 px-4 py-2 text-yellow-400 hover:text-yellow-300 text-xs font-medium transition-colors"
              >
                See All History
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
        
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
