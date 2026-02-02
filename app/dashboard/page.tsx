import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '../components/BottomNav'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get user's assigned programs (using client_programs table)
  const { data: userPrograms } = await supabase
    .from('client_programs')
    .select(`
      id,
      program_id,
      programs (
        id,
        name,
        emoji,
        program_workouts (
          id,
          name,
          day_of_week,
          order_index,
          workout_exercises (
            id,
            exercise_name
          )
        )
      )
    `)
    .eq('client_id', user.id)
    .eq('is_active', true)

  // Get today's day of week (0 = Sunday, 1 = Monday, etc.)
  const todayDayOfWeek = new Date().getDay()
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  
  // Find today's workout from assigned programs
  let todayWorkout: { 
    id: string
    name: string
    programName: string
    programEmoji?: string
    clientProgramId: string
    exerciseCount: number
  } | null = null
  
  if (userPrograms) {
    for (const up of userPrograms) {
      const programData = up.programs as unknown
      const program = (Array.isArray(programData) ? programData[0] : programData) as { 
        id: string
        name: string
        emoji?: string
        program_workouts?: { 
          id: string
          name: string
          day_of_week: number | null
          workout_exercises?: { id: string }[]
        }[] 
      } | null
      if (program?.program_workouts) {
        for (const workout of program.program_workouts) {
          if (workout.day_of_week === todayDayOfWeek) {
            todayWorkout = {
              id: workout.id,
              name: workout.name,
              programName: program.name,
              programEmoji: program.emoji,
              clientProgramId: up.id,
              exerciseCount: workout.workout_exercises?.length || 0
            }
            break
          }
        }
      }
      if (todayWorkout) break
    }
  }

  const firstName = profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'there'
  const greeting = getGreeting()

  function getGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="min-h-screen bg-black pb-32">
      {/* Header */}
      <header className="bg-gradient-to-b from-zinc-900 to-black border-b border-zinc-800">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-zinc-500 text-sm">{greeting},</p>
              <h1 className="text-2xl font-bold text-white">{firstName}</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              <span className="text-lg font-bold tracking-wider text-white">CMPD</span>
            </div>
          </div>
          
          {/* Today Banner */}
          <div className="bg-zinc-800/50 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400/20 rounded-lg flex items-center justify-center">
              <span className="text-yellow-400 text-lg">📅</span>
            </div>
            <div>
              <p className="text-white font-medium">{daysOfWeek[todayDayOfWeek]}</p>
              <p className="text-zinc-400 text-sm">
                {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 space-y-6">
        {/* Today's Workout - Main Focus */}
        <section>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Today&apos;s Workout</h2>
          
          {todayWorkout ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              {/* Workout Info */}
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-yellow-400/10 rounded-2xl flex items-center justify-center text-3xl">
                    {todayWorkout.programEmoji || '💪'}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white">{todayWorkout.name}</h3>
                    <p className="text-yellow-400 text-sm mt-1">{todayWorkout.programName}</p>
                    <p className="text-zinc-500 text-sm mt-2">
                      {todayWorkout.exerciseCount} exercises
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Start Button */}
              <Link
                href={`/workout/${todayWorkout.id}?clientProgramId=${todayWorkout.clientProgramId}`}
                className="block w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-4 text-center transition-colors"
              >
                Start Workout →
              </Link>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                😴
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
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 flex flex-col items-center text-center transition-colors"
            >
              <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mb-3">
                <span className="text-2xl">📋</span>
              </div>
              <span className="text-white font-medium">My Programs</span>
              <span className="text-zinc-500 text-xs mt-1">{userPrograms?.length || 0} active</span>
            </Link>
            
            <Link
              href="/schedule"
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 flex flex-col items-center text-center transition-colors"
            >
              <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mb-3">
                <span className="text-2xl">📆</span>
              </div>
              <span className="text-white font-medium">Schedule</span>
              <span className="text-zinc-500 text-xs mt-1">View week</span>
            </Link>
            
            <Link
              href="/nutrition"
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 flex flex-col items-center text-center transition-colors"
            >
              <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mb-3">
                <span className="text-2xl">🍎</span>
              </div>
              <span className="text-white font-medium">Nutrition</span>
              <span className="text-zinc-500 text-xs mt-1">Meal plan</span>
            </Link>
            
            <Link
              href="/profile"
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 flex flex-col items-center text-center transition-colors"
            >
              <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center mb-3">
                <span className="text-2xl">⚙️</span>
              </div>
              <span className="text-white font-medium">Profile</span>
              <span className="text-zinc-500 text-xs mt-1">1RM & settings</span>
            </Link>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  )
}
