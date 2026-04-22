'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { SlideOutMenu, HamburgerButton } from '../components/SlideOutMenu'
import WorkoutCalendar from '../components/WorkoutCalendar'
import Pascal from '@/components/Pascal'

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
  streak?: number
  longestStreak?: number
  lastProgressPhotoDate?: string | null
}

type PascalData = { score: number; max: number; stage: number; tier: 1 | 2 | 3 | 4 }
const pascalFetcher = (url: string): Promise<PascalData> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('pascal fetch failed')
    return r.json()
  })

type GoalSummary = {
  id: string
  title: string
  kind: 'lift' | 'workouts' | 'body_weight' | 'custom'
  target_value: number | null
  current_value: number
  achieved: boolean
}
const goalsFetcher = (url: string): Promise<{ goals: GoalSummary[] }> =>
  fetch(url).then((r) => r.json())

// Small square-ish tile shared by the dashboard compact row.
function TileShell({
  href,
  title,
  subtitle,
  accent,
  children,
  ariaLabel,
}: {
  href: string
  title: string
  subtitle: string
  accent: 'yellow' | 'zinc'
  children?: React.ReactNode
  ariaLabel?: string
}) {
  const borderCls = accent === 'yellow' ? 'border-yellow-400/30 hover:border-yellow-400/50' : 'border-zinc-800 hover:border-yellow-400/40'
  const bgCls = accent === 'yellow' ? 'bg-gradient-to-br from-yellow-400/10 to-yellow-500/5' : 'bg-zinc-900'
  return (
    <Link
      href={href}
      aria-label={ariaLabel || title}
      className={`flex flex-col justify-between p-3 rounded-xl border ${borderCls} ${bgCls} transition-colors min-h-[86px]`}
    >
      <div>
        <p className="text-sm font-semibold text-white leading-tight">{title}</p>
        <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{subtitle}</p>
      </div>
      {children}
    </Link>
  )
}

function CompactTilesRow({
  topGoal,
  goalsLoaded,
  lastProgressPhotoDate,
  todayHasWorkouts,
}: {
  topGoal: GoalSummary | null
  goalsLoaded: boolean
  lastProgressPhotoDate: string | null
  todayHasWorkouts: boolean
}) {
  // Photo tile logic (same rules as before)
  const daysSincePhoto = lastProgressPhotoDate
    ? Math.floor((Date.now() - new Date(lastProgressPhotoDate).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const photoOverdue = daysSincePhoto !== null && daysSincePhoto >= 28
  const photoFirstTime = lastProgressPhotoDate === null
  const photoRestDayNudge = !todayHasWorkouts && daysSincePhoto !== null && daysSincePhoto >= 7
  const showPhoto = photoOverdue || photoFirstTime || photoRestDayNudge

  // Goal tile logic
  const showGoalTile = goalsLoaded
  const goalHasTarget = topGoal?.target_value != null && topGoal.target_value > 0
  const goalPct = goalHasTarget
    ? Math.min(100, Math.round((topGoal!.current_value / topGoal!.target_value!) * 100))
    : null

  if (!showGoalTile && !showPhoto) return null

  const photoCopy = photoFirstTime
    ? { title: 'First progress photo', subtitle: 'Set your baseline' }
    : photoOverdue
    ? { title: 'Progress photo time', subtitle: `${daysSincePhoto} days since last` }
    : { title: 'Snap a progress photo', subtitle: 'Rest day, perfect moment' }

  return (
    <section className="mt-4 grid grid-cols-2 gap-2">
      {showGoalTile && (
        topGoal ? (
          <TileShell
            href="/goals"
            title={topGoal.title}
            subtitle={
              goalHasTarget
                ? `${topGoal.current_value} / ${topGoal.target_value}`
                : 'Goal'
            }
            accent="zinc"
          >
            {goalHasTarget && (
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all"
                  style={{ width: `${goalPct ?? 0}%` }}
                />
              </div>
            )}
          </TileShell>
        ) : (
          <TileShell
            href="/goals"
            title="Set a goal"
            subtitle="Give sessions a target"
            accent="zinc"
          />
        )
      )}

      {showPhoto && (
        <TileShell
          href="/progress-pictures"
          title={photoCopy.title}
          subtitle={photoCopy.subtitle}
          accent="yellow"
        />
      )}

      {/* If only one tile applies, make it span both columns */}
      {showGoalTile !== showPhoto && <span className="hidden" />}
      <style jsx>{`
        section {
          grid-template-columns: ${showGoalTile && showPhoto ? '1fr 1fr' : '1fr'};
        }
      `}</style>
    </section>
  )
}

function greetingFor(tier: 1 | 2 | 3 | 4): string {
  switch (tier) {
    case 1:
      return "Ugh. Help me out?"
    case 2:
      return "Let's go train."
    case 3:
      return 'Feeling sharp!'
    case 4:
      return "Look at us!"
  }
}

export default function DashboardClient({ firstName, workoutsByDay, programCount, completedWorkouts, scheduleByDay, scheduleByWeekAndDay, calendarCompletions, programStartDate, maxWeek = 1, streak = 0, lastProgressPhotoDate = null }: DashboardClientProps) {
  const completedSet = new Set(completedWorkouts)
  const [mounted, setMounted] = useState(false)
  const [greeting, setGreeting] = useState('Hello')
  const [todayDayOfWeek, setTodayDayOfWeek] = useState(new Date().getDay())
  const [todayDateStr, setTodayDateStr] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showPascalGreeting, setShowPascalGreeting] = useState(false)
  const [pascalTyped, setPascalTyped] = useState('')

  // Pascal mascot score — cached for 5 minutes alongside the other
  // client-side SWR calls. Fetched with the user's IANA tz so the
  // daily rollover aligns with their local midnight.
  const tz = typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
  const { data: pascalData } = useSWR<PascalData>(`/api/pascal?tz=${encodeURIComponent(tz)}`, pascalFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 300000,
    shouldRetryOnError: false,
  })

  const { data: goalsData } = useSWR('/api/goals', goalsFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000,
    shouldRetryOnError: false,
  })
  const topGoal = (goalsData?.goals || []).find((g) => !g.achieved) || null

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

    // Show Pascal's greeting bubble once per browser session.
    try {
      const key = 'cmpd:pascal-greeted'
      if (!sessionStorage.getItem(key)) {
        setShowPascalGreeting(true)
        sessionStorage.setItem(key, '1')
      }
    } catch {
      // sessionStorage unavailable (private mode) — skip.
    }
  }, [])

  // Typewriter reveal: one char every ~35ms until the full line is shown.
  // Then auto-dismiss a few seconds after the last character.
  useEffect(() => {
    if (!showPascalGreeting || !pascalData) {
      setPascalTyped('')
      return
    }
    const full = greetingFor(pascalData.tier)
    setPascalTyped('')
    let i = 0
    const tick = setInterval(() => {
      i++
      setPascalTyped(full.slice(0, i))
      if (i >= full.length) clearInterval(tick)
    }, 35)

    const dismiss = setTimeout(
      () => setShowPascalGreeting(false),
      full.length * 35 + 4000
    )

    return () => {
      clearInterval(tick)
      clearTimeout(dismiss)
    }
  }, [showPascalGreeting, pascalData])

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
  
  if (!mounted) {
    return <div className="px-6 py-6"><div className="h-32 bg-zinc-800 rounded-2xl animate-pulse" /></div>
  }

  return (
    <>
      {/* Slide Out Menu */}
      <SlideOutMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Sticky top bar — hamburger + streak always visible even when scrolled.
          Fixed position so body content scrolls under it. Own safe-area-inset-top
          padding so it sits below the iOS status bar / Dynamic Island. z-30 keeps
          it above page content but below the slide-out drawer (z-50). */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-black flex items-center justify-between px-4 py-2" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}>
        <HamburgerButton onClick={() => setMenuOpen(true)} />
        {streak > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full">
            <svg className="w-3.5 h-3.5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
            </svg>
            <span className="text-orange-400 font-semibold text-xs">{streak}</span>
          </div>
        )}
      </div>

      {/* Header - pure black to seamlessly meet the iOS status bar safe-area strip (body bg = #000). */}
      <header className="relative bg-black border-b border-zinc-800">
        <div className="px-4 pt-14 pb-4">
          {/* Greeting - Top */}
          <div className="text-center mb-4">
            <p className="text-zinc-500 text-sm">{greeting},</p>
            <h1 className="text-2xl font-bold text-white">{firstName}</h1>
          </div>

          {/* Pascal — fitness-consistency mascot. Extra top padding leaves
             room for the speech bubble above his head without shifting
             the greeting when the bubble appears. */}
          <div className="flex flex-col items-center mb-4 pt-8">
            <div className="relative w-[120px] h-[120px] flex items-center justify-center">
              {pascalData ? (
                <Pascal score={pascalData.score} />
              ) : (
                <div className="w-[96px] h-[96px] rounded-2xl bg-zinc-800/40 animate-pulse" />
              )}
              {/* Speech bubble — floats directly above Pascal's head with a
                 downward-pointing tail. Centered horizontally and capped at
                 80vw so it never triggers the sideways-swipe overflow that
                 the old right-anchored bubble caused on narrow phones. */}
              {pascalData && showPascalGreeting && (
                <button
                  type="button"
                  onClick={() => setShowPascalGreeting(false)}
                  className="pascal-bubble absolute left-1/2 -translate-x-1/2 -top-8 max-w-[80vw] whitespace-nowrap text-center bg-white text-black text-xs font-medium leading-snug rounded-full px-3 py-1.5 shadow-lg"
                  aria-label="Dismiss Pascal's greeting"
                >
                  <span>
                    {pascalTyped}
                    {pascalTyped.length < greetingFor(pascalData.tier).length && (
                      <span className="pascal-caret" aria-hidden>
                        ▎
                      </span>
                    )}
                  </span>
                  <span className="pascal-bubble-tail" aria-hidden />
                </button>
              )}
            </div>
            {pascalData && (
              <div className="text-center mt-1">
                <p className="text-white text-sm font-semibold tabular-nums">
                  {pascalData.score} / {pascalData.max}
                </p>
                <p className="text-zinc-500 text-xs uppercase tracking-wider">
                  Stage {pascalData.stage}
                </p>
              </div>
            )}
          </div>

          <style jsx>{`
            @keyframes pascal-bubble-in {
              0% {
                opacity: 0;
                transform: translateY(6px) scale(0.94);
              }
              100% {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
            .pascal-bubble {
              animation: pascal-bubble-in 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
              transform-origin: bottom left;
            }
            /* Tail points down, under the centered bubble, toward Pascal's head. */
            .pascal-bubble-tail {
              position: absolute;
              left: 50%;
              transform: translateX(-50%);
              bottom: -6px;
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 7px solid #ffffff;
            }
            @keyframes pascal-caret-blink {
              0%, 50% { opacity: 1; }
              51%, 100% { opacity: 0; }
            }
            .pascal-caret {
              display: inline-block;
              margin-left: 1px;
              animation: pascal-caret-blink 900ms steps(1, end) infinite;
              color: #52525b;
            }
            @media (prefers-reduced-motion: reduce) {
              .pascal-bubble, .pascal-caret { animation: none; }
            }
          `}</style>

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
                const workoutHref = `/workout/${workout.workoutId}?clientProgramId=${workout.clientProgramId}`
                const CardContent = (
                  <>
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
                          <span className="text-green-400 text-xs font-medium flex items-center gap-1">
                            Done
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-xs">{workout.exerciseCount} exercises</span>
                        )}
                      </div>
                    </div>
                    {!completed && (
                      <div className="block w-full bg-yellow-400 text-black font-semibold py-2.5 text-sm text-center transition-all">
                        Start Workout →
                      </div>
                    )}
                  </>
                )
                // Completed cards link to the workout so clients can review
                // (same destination as tapping a green day in the calendar).
                return (
                  <Link
                    href={workoutHref}
                    key={`${workout.workoutId}-${workout.clientProgramId}`}
                    className={`block rounded-xl overflow-hidden transition-all active:scale-[0.99] ${
                      completed
                        ? 'bg-green-500/10 border border-green-500/30 hover:border-green-500/50'
                        : 'bg-zinc-900 border border-zinc-800 hover:bg-yellow-500'
                    }`}
                  >
                    {CardContent}
                  </Link>
                )
              })}

              {/* Tomorrow preview as a single-line footer under today's list */}
              {tomorrowWorkouts.length > 0 && (
                <Link
                  href={`/workout/${tomorrowWorkouts[0].workoutId}?clientProgramId=${tomorrowWorkouts[0].clientProgramId}&preview=true`}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800/50 text-xs hover:border-zinc-700 transition-colors"
                >
                  <span className="text-zinc-500">Tomorrow</span>
                  <span className="text-zinc-300 truncate">
                    {tomorrowWorkouts[0].workoutName}
                    {tomorrowWorkouts.length > 1 && ` +${tomorrowWorkouts.length - 1}`}
                  </span>
                  <svg className="w-3 h-3 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
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

        {/* Compact tiles row — Goal + Photo prompt side by side to
           reduce vertical clutter. Each collapses to full width if the
           other doesn't apply. */}
        <CompactTilesRow
          topGoal={topGoal}
          goalsLoaded={!!goalsData}
          lastProgressPhotoDate={lastProgressPhotoDate}
          todayHasWorkouts={todayWorkouts.length > 0}
        />

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
