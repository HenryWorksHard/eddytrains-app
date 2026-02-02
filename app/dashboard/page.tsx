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
      *,
      programs (*)
    `)
    .eq('client_id', user.id)
    .eq('is_active', true)

  // Get today's schedule
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const { data: todaySchedule } = await supabase
    .from('schedules')
    .select(`
      *,
      programs (name, emoji)
    `)
    .eq('user_id', user.id)
    .eq('day_of_week', today)

  const firstName = profile?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'there'

  return (
    <div className="min-h-screen bg-black pb-32">
      {/* Header - Industrial Minimal */}
      <header className="sticky top-0 bg-black/95 backdrop-blur-lg border-b border-zinc-800 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-zinc-500 text-sm">Welcome back,</p>
              <h1 className="text-xl font-bold text-white">{firstName}</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold tracking-widest" style={{ fontFamily: 'Sora, sans-serif' }}>CMPD</span>
              <div className="w-8 h-1 bg-yellow-400"></div>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 space-y-8">
        {/* Today's Workout */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Today&apos;s Workout</h2>
          {todaySchedule && todaySchedule.length > 0 ? (
            <div className="space-y-3">
              {todaySchedule.map((schedule: { id: string; workout_name: string; programs?: { emoji?: string; name?: string } }) => (
                <div 
                  key={schedule.id}
                  className="bg-zinc-900 border-l-4 border-yellow-400 rounded-r-2xl p-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-yellow-400/20 rounded-xl flex items-center justify-center">
                      <svg className="w-7 h-7 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white text-lg">{schedule.workout_name}</h3>
                      <p className="text-yellow-400 text-sm">{schedule.programs?.name || 'Workout'}</p>
                    </div>
                    <Link 
                      href={`/schedule`}
                      className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-bold uppercase tracking-wider rounded-lg transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
              <p className="text-zinc-400">Rest day. Take it easy.</p>
            </div>
          )}
        </section>

        {/* My Programs */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">My Programs</h2>
            <Link href="/programs" className="text-yellow-400 text-sm font-medium">
              See all →
            </Link>
          </div>
          
          {userPrograms && userPrograms.length > 0 ? (
            <div className="grid gap-3">
              {userPrograms.slice(0, 3).map((up: { program_id: string; programs?: { name?: string } }) => (
                <Link
                  key={up.program_id}
                  href={`/programs/${up.program_id}`}
                  className="bg-zinc-900 border border-zinc-800 hover:border-yellow-400/50 rounded-2xl p-4 flex items-center gap-3 transition-colors"
                >
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-white flex-1 truncate">{up.programs?.name || 'Program'}</h3>
                  <span className="text-zinc-600 flex-shrink-0">→</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
              <p className="text-zinc-400">No programs assigned yet.</p>
              <p className="text-zinc-500 text-sm mt-1">Contact your coach to get started.</p>
            </div>
          )}
        </section>

        {/* Quick Stats */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">This Week</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {userPrograms?.length || 0}
              </div>
              <p className="text-zinc-500 text-sm mt-1">Active Programs</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {todaySchedule?.length || 0}
              </div>
              <p className="text-zinc-500 text-sm mt-1">Today&apos;s Sessions</p>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  )
}
