'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SlideOutMenu, HamburgerButton } from '../components/SlideOutMenu'
import WorkoutCalendar from '../components/WorkoutCalendar'

interface Workout {
  workoutId: string
  workoutName: string
  programName: string
  programCategory: string
  clientProgramId: string
  exerciseCount: number
}

interface WorkoutSchedule {
  dayOfWeek: number
  workoutId: string
  workoutName: string
  programName: string
  programCategory: string
  clientProgramId: string
}

interface DashboardClientProps {
  firstName: string
  workoutsByDay: Record<number, Workout[]>
  programCount: number
  completedWorkouts: string[] // Array of "workoutId:clientProgramId" strings
  scheduleByDay: Record<number, WorkoutSchedule[]>
  scheduleByWeekAndDay?: Record<number, Record<number, WorkoutSchedule[]>>
  calendarCompletions: Record<string, boolean>
  programStartDate?: string
  maxWeek?: number
}

export default function DashboardClient({ firstName, workoutsByDay, programCount, completedWorkouts, scheduleByDay, scheduleByWeekAndDay, calendarCompletions, programStartDate, maxWeek = 1 }: DashboardClientProps) {
  const completedSet = new Set(completedWorkouts)
  const [mounted, setMounted] = useState(false)
  const [greeting, setGreeting] = useState('Hello')
  const [todayDayOfWeek, setTodayDayOfWeek] = useState(new Date().getDay())
  const [todayDateStr, setTodayDateStr] = useState('')
  const [streak, setStreak] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayAbbrev = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

  useEffect(() => {
    setMounted(true)
    
    // Get user's local time
    const now = new Date()
    const hour = now.getHours()
    const dayOfWeek = now.getDay()
    
    // Set greeting based on local time
    if (hour >= 5 && hour < 12) {
      setGreeting('Good morning')
    } else if (hour >= 12 && hour < 17) {
      setGreeting('Good afternoon')
    } else if (hour >= 17 && hour < 21) {
      setGreeting('Good evening')
    } else {
      setGreeting('Good night')
    }
    
    // Set local day of week
    setTodayDayOfWeek(dayOfWeek)
    
    // Format date in user's locale
    setTodayDateStr(now.toLocaleDateString(undefined, { day: 'numeric', month: 'long' }))
    
    // Fetch streak
    fetchStreak()
  }, [])

  const fetchStreak = async () => {
    try {
      const response = await fetch('/api/workouts/streak')
      if (response.ok) {
        const data = await response.json()
        setStreak(data.streak || 0)
      }
    } catch (error) {
      console.error('Failed to fetch streak:', error)
    }
  }

  const todayWorkouts = workoutsByDay[todayDayOfWeek] || []
  const tomorrowDayOfWeek = (todayDayOfWeek + 1) % 7
  const tomorrowWorkouts = workoutsByDay[tomorrowDayOfWeek] || []
  
  // Check if a workout is completed
  const isWorkoutCompleted = (workout: Workout) => {
    return completedSet.has(`${workout.workoutId}:${workout.clientProgramId}`)
  }
  
  // Get category color
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'strength': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'cardio': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'hyrox': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'hybrid': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      default: return 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30'
    }
  }
  
  const allTodayCompleted = todayWorkouts.length > 0 && todayWorkouts.every(w => isWorkoutCompleted(w))

  if (!mounted) {
    return <div className="px-6 py-6"><div className="h-32 bg-zinc-800 rounded-2xl animate-pulse" /></div>
  }

  return (
    <>
      {/* Slide Out Menu */}
      <SlideOutMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      
      {/* Header */}
      <header className="relative bg-gradient-to-b from-zinc-900 to-black border-b border-zinc-800">
        <div className="px-4 pt-14 pb-4">
          {/* Greeting - Top */}
          <div className="text-center mb-4">
            <p className="text-zinc-500 text-sm">{greeting},</p>
            <h1 className="text-2xl font-bold text-white">{firstName}</h1>
          </div>
          
          {/* Hamburger positioned top-left */}
          <div className="absolute top-4 left-4">
            <HamburgerButton onClick={() => setMenuOpen(true)} />
          </div>
          
          {/* Streak positioned top-right */}
          {streak > 0 && (
            <div className="absolute top-4 right-4">
              <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full">
                <svg className="w-3.5 h-3.5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
                <span className="text-orange-400 font-semibold text-xs">{streak}</span>
              </div>
            </div>
          )}
          
          {/* Today Banner - compact */}
          <div className="bg-zinc-800/50 rounded-lg px-3 py-2 flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-400/20 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium text-sm">{daysOfWeek[todayDayOfWeek]}</p>
              <p className="text-zinc-400 text-xs">{todayDateStr}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Today's Workouts - Main Focus */}
        <section>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
            Today&apos;s Workout{todayWorkouts.length > 1 ? 's' : ''}
          </h2>
          
          {todayWorkouts.length > 0 ? (
            <div className="space-y-2">
              {todayWorkouts.map((workout) => {
                const completed = isWorkoutCompleted(workout)
                return (
                  <div 
                    key={`${workout.workoutId}-${workout.clientProgramId}`}
                    className={`rounded-xl overflow-hidden transition-all ${
                      completed 
                        ? 'bg-green-500/10 border border-green-500/30' 
                        : 'bg-zinc-900 border border-zinc-800'
                    }`}
                  >
                    {/* Workout Info */}
                    <div className="p-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          completed ? 'bg-green-500/20' : 'bg-yellow-400/20'
                        }`}>
                          {completed ? (
                            <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="text-xs font-bold text-yellow-400">
                              {dayAbbrev[todayDayOfWeek]}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-semibold text-sm ${completed ? 'text-green-400' : 'text-white'}`}>{workout.workoutName}</h3>
                          <p className="text-zinc-500 text-xs">{workout.programName}</p>
                        </div>
                        {completed ? (
                          <span className="text-green-400 text-xs font-medium">Done</span>
                        ) : (
                          <span className="text-zinc-500 text-xs">{workout.exerciseCount} exercises</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Start Button - only show if not completed */}
                    {!completed && (
                      <Link
                        href={`/workout/${workout.workoutId}?clientProgramId=${workout.clientProgramId}`}
                        className="block w-full bg-yellow-400 hover:bg-yellow-500 active:scale-[0.98] text-black font-semibold py-2.5 text-sm text-center transition-all touch-feedback tap-target"
                      >
                        Start Workout →
                      </Link>
                    )}
                  </div>
                )
              })}
              
              {/* Tomorrow preview - show when all today's workouts are done */}
              {allTodayCompleted && tomorrowWorkouts.length > 0 && (
                <div className="tomorrow-preview border rounded-lg p-3 mt-3">
                  <p className="text-zinc-500 text-xs mb-1.5">Tomorrow</p>
                  {tomorrowWorkouts.map((workout) => (
                    <Link
                      key={`tomorrow-${workout.workoutId}`}
                      href={`/workout/${workout.workoutId}?clientProgramId=${workout.clientProgramId}&preview=true`}
                      className="flex items-center justify-between py-1.5 hover:bg-zinc-800/50 -mx-1.5 px-1.5 rounded-lg transition-colors touch-feedback"
                    >
                      <span className="text-theme-primary text-sm">{workout.workoutName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 text-xs">{workout.programName}</span>
                        <span className="text-yellow-400 text-sm">→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-sm mb-1">Rest Day</h3>
              <p className="text-zinc-500 text-xs">No workout scheduled for today. Recover well!</p>
            </div>
          )}
        </section>

        {/* Tomorrow Preview - always show if there's a workout */}
        {tomorrowWorkouts.length > 0 && (
          <section className="mt-4">
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Tomorrow</h2>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
              {tomorrowWorkouts.map((workout) => (
                <div
                  key={`tomorrow-${workout.workoutId}`}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-medium text-zinc-400">
                        {dayAbbrev[(todayDayOfWeek + 1) % 7]}
                      </span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{workout.workoutName}</p>
                      <p className="text-zinc-500 text-xs">{workout.exerciseCount} exercises</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Monthly Calendar */}
        <section className="mt-4">
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">This Month</h2>
          <WorkoutCalendar 
            scheduleByDay={scheduleByDay}
            scheduleByWeekAndDay={scheduleByWeekAndDay}
            completedWorkouts={calendarCompletions}
            compact={true}
            programStartDate={programStartDate}
            maxWeek={maxWeek}
          />
        </section>
      </main>
    </>
  )
}
