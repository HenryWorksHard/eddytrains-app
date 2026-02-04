'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Workout {
  id: string
  name: string
  programName: string
  programCategory: string
  clientProgramId: string
  exerciseCount: number
}

interface DashboardClientProps {
  firstName: string
  workoutsByDay: Record<number, Workout[]>
  programCount: number
  completedWorkouts: string[] // Array of "workoutId:clientProgramId" strings
}

export default function DashboardClient({ firstName, workoutsByDay, programCount, completedWorkouts }: DashboardClientProps) {
  const completedSet = new Set(completedWorkouts)
  const [mounted, setMounted] = useState(false)
  const [greeting, setGreeting] = useState('Hello')
  const [todayDayOfWeek, setTodayDayOfWeek] = useState(new Date().getDay())
  const [todayDateStr, setTodayDateStr] = useState('')
  const [streak, setStreak] = useState(0)

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
    return completedSet.has(`${workout.id}:${workout.clientProgramId}`)
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
      {/* Header */}
      <header className="bg-gradient-to-b from-zinc-900 to-black border-b border-zinc-800">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-zinc-500 text-sm">{greeting},</p>
              <h1 className="text-2xl font-bold text-white">{firstName}</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              <span className="text-lg font-bold tracking-wider text-white">CMPD</span>
            </div>
          </div>

          {/* Streak Badge */}
          {streak > 0 && (
            <div className="mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full">
                <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
                <span className="text-orange-400 font-semibold text-sm">{streak} day streak</span>
              </div>
            </div>
          )}
          
          {/* Today Banner */}
          <div className="bg-zinc-800/50 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium">{daysOfWeek[todayDayOfWeek]}</p>
              <p className="text-zinc-400 text-sm">{todayDateStr}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 space-y-6">
        {/* Today's Workouts - Main Focus */}
        <section>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
            Today&apos;s Workout{todayWorkouts.length > 1 ? 's' : ''}
          </h2>
          
          {todayWorkouts.length > 0 ? (
            <div className="space-y-3">
              {todayWorkouts.map((workout) => {
                const completed = isWorkoutCompleted(workout)
                return (
                  <div 
                    key={`${workout.id}-${workout.clientProgramId}`}
                    className={`rounded-2xl overflow-hidden transition-all ${
                      completed 
                        ? 'bg-green-500/10 border border-green-500/30' 
                        : 'bg-zinc-900 border border-zinc-800'
                    }`}
                  >
                    {/* Workout Info */}
                    <div className="p-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          completed ? 'bg-green-500/20' : 'bg-yellow-400/20'
                        }`}>
                          {completed ? (
                            <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="text-sm font-bold text-yellow-400">
                              {dayAbbrev[todayDayOfWeek]}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-bold ${completed ? 'text-green-400' : 'text-white'}`}>{workout.name}</h3>
                          <p className="text-zinc-500 text-sm">{workout.programName}</p>
                        </div>
                        {completed ? (
                          <span className="text-green-400 text-sm font-medium">Done</span>
                        ) : (
                          <span className="text-zinc-500 text-sm">{workout.exerciseCount} exercises</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Start Button - only show if not completed */}
                    {!completed && (
                      <Link
                        href={`/workout/${workout.id}?clientProgramId=${workout.clientProgramId}`}
                        className="block w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 text-center transition-colors"
                      >
                        Start Workout →
                      </Link>
                    )}
                  </div>
                )
              })}
              
              {/* Tomorrow preview - show when all today's workouts are done */}
              {allTodayCompleted && tomorrowWorkouts.length > 0 && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mt-4">
                  <p className="text-zinc-500 text-sm mb-2">Tomorrow</p>
                  {tomorrowWorkouts.map((workout) => (
                    <Link
                      key={`tomorrow-${workout.id}`}
                      href={`/workout/${workout.id}?clientProgramId=${workout.clientProgramId}&preview=true`}
                      className="flex items-center justify-between py-2 hover:bg-zinc-800/50 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <span className="text-white">{workout.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 text-sm">{workout.programName}</span>
                        <span className="text-yellow-400">→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-1">Rest Day</h3>
              <p className="text-zinc-500 text-sm">No workout scheduled for today. Recover well!</p>
            </div>
          )}
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/programs"
              className="bg-zinc-900 border border-zinc-800 hover:border-yellow-400/50 rounded-2xl p-4 flex flex-col items-center text-center transition-colors"
            >
              <div className="w-12 h-12 bg-yellow-400/10 rounded-xl flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <span className="text-white font-medium">My Programs</span>
              <span className="text-zinc-500 text-xs mt-1">{programCount} active</span>
            </Link>
            
            <Link
              href="/schedule"
              className="bg-zinc-900 border border-zinc-800 hover:border-blue-400/50 rounded-2xl p-4 flex flex-col items-center text-center transition-colors"
            >
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-white font-medium">Schedule</span>
              <span className="text-zinc-500 text-xs mt-1">View week</span>
            </Link>
            
            <Link
              href="/nutrition"
              className="bg-zinc-900 border border-zinc-800 hover:border-green-400/50 rounded-2xl p-4 flex flex-col items-center text-center transition-colors"
            >
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <span className="text-white font-medium">Nutrition</span>
              <span className="text-zinc-500 text-xs mt-1">Meal plan</span>
            </Link>
            
            <Link
              href="/profile"
              className="bg-zinc-900 border border-zinc-800 hover:border-purple-400/50 rounded-2xl p-4 flex flex-col items-center text-center transition-colors"
            >
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-white font-medium">Profile</span>
              <span className="text-zinc-500 text-xs mt-1">1RM & settings</span>
            </Link>
          </div>
        </section>

        {/* Progress Tracker */}
        <section>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Progress Tracker</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/progress-pictures"
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 flex flex-col items-center text-center transition-colors"
            >
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-white font-medium">Progress Pictures</span>
              <span className="text-zinc-500 text-xs mt-1">Track transformation</span>
            </Link>
            
            <Link
              href="/1rm-tracking"
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 flex flex-col items-center text-center transition-colors"
            >
              <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-white font-medium">1RM Tracking</span>
              <span className="text-zinc-500 text-xs mt-1">One-rep maxes</span>
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}
