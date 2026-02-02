import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '../components/BottomNav'
import Link from 'next/link'

interface ProgramWorkout {
  id: string
  name: string
  day_of_week: number | null
  order_index: number
}

export default async function ProgramsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const today = new Date().toISOString().split('T')[0]
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Get user's CURRENT program only (where today is between start_date and end_date)
  const { data: currentProgram } = await supabase
    .from('client_programs')
    .select(`
      *,
      program:programs (*)
    `)
    .eq('client_id', user.id)
    .lte('start_date', today)
    .or(`end_date.gte.${today},end_date.is.null`)
    .order('start_date', { ascending: false })
    .limit(1)
    .single()

  // Fetch program workouts if we have a current program
  let programWorkouts: ProgramWorkout[] = []
  if (currentProgram?.program_id) {
    const { data: workouts } = await supabase
      .from('program_workouts')
      .select('id, name, day_of_week, order_index')
      .eq('program_id', currentProgram.program_id)
      .order('order_index')
    
    programWorkouts = workouts || []
  }

  // Fallback: check old user_programs table if no client_programs found
  let fallbackPrograms: { program_id: string; programs?: { name?: string; description?: string; emoji?: string; type?: string } }[] = []
  if (!currentProgram) {
    const { data: userPrograms } = await supabase
      .from('user_programs')
      .select(`
        *,
        programs (*)
      `)
      .eq('user_id', user.id)
    fallbackPrograms = userPrograms || []
  }

  // Calculate progress if we have a current program
  const getProgress = () => {
    if (!currentProgram) return null
    const start = new Date(currentProgram.start_date)
    const end = currentProgram.end_date ? new Date(currentProgram.end_date) : null
    const now = new Date()
    
    if (!end) return null
    
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const daysElapsed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const weeksElapsed = Math.ceil(daysElapsed / 7)
    const totalWeeks = currentProgram.duration_weeks || Math.ceil(totalDays / 7)
    
    return {
      week: Math.min(weeksElapsed, totalWeeks),
      totalWeeks,
      percentage: Math.min(Math.round((daysElapsed / totalDays) * 100), 100),
      daysRemaining: Math.max(0, totalDays - daysElapsed)
    }
  }

  const progress = getProgress()

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header - Industrial Minimal */}
      <header className="sticky top-0 bg-black/95 backdrop-blur-lg border-b border-zinc-800 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-widest" style={{ fontFamily: 'Sora, sans-serif' }}>YOUR PROGRAM</h1>
            <div className="w-8 h-1 bg-yellow-400"></div>
          </div>
          <p className="text-zinc-500 text-sm mt-1">Current training program</p>
        </div>
      </header>

      <main className="px-6 py-6">
        {currentProgram ? (
          <div className="space-y-6">
            {/* Current Program Card */}
            <div className="bg-zinc-900 border border-yellow-400/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-1 bg-yellow-400 text-black text-xs font-bold rounded">
                  ACTIVE
                </span>
                {progress && (
                  <span className="text-zinc-500 text-sm">
                    Week {progress.week} of {progress.totalWeeks}
                  </span>
                )}
              </div>

              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-yellow-400/10 rounded-xl flex items-center justify-center text-3xl shrink-0">
                  
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-xl">{currentProgram.program?.name || 'Program'}</h3>
                  {currentProgram.phase_name && (
                    <p className="text-yellow-400/80 text-sm mt-1">{currentProgram.phase_name}</p>
                  )}
                  <p className="text-zinc-400 text-sm mt-1 line-clamp-2">{currentProgram.program?.description || ''}</p>
                </div>
              </div>

              {/* Progress Bar */}
              {progress && (
                <div className="mt-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-500">Progress</span>
                    <span className="text-yellow-400 font-medium">{progress.percentage}%</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                  <p className="text-zinc-600 text-xs mt-2">
                    {progress.daysRemaining > 0 
                      ? `${progress.daysRemaining} days remaining`
                      : 'Completing soon!'
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Workouts List */}
            {programWorkouts.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-zinc-400 text-sm font-medium uppercase tracking-wider px-1">Workouts</h4>
                {programWorkouts.map((workout, idx) => (
                  <Link
                    key={workout.id}
                    href={`/workout/${workout.id}?clientProgramId=${currentProgram.id}`}
                    className="block bg-zinc-900 border border-zinc-800 hover:border-yellow-400/50 rounded-xl p-4 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-yellow-400/10 flex items-center justify-center">
                        <span className="text-yellow-400 font-bold text-sm">{idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">{workout.name}</p>
                        {workout.day_of_week !== null && (
                          <p className="text-zinc-500 text-sm">{daysOfWeek[workout.day_of_week]}</p>
                        )}
                      </div>
                      <span className="text-yellow-400">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Program Details */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <h4 className="text-zinc-400 text-sm font-medium mb-3">SCHEDULE</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-zinc-500">Started</p>
                  <p className="text-white font-medium">
                    {new Date(currentProgram.start_date).toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                {currentProgram.end_date && (
                  <div>
                    <p className="text-zinc-500">Ends</p>
                    <p className="text-white font-medium">
                      {new Date(currentProgram.end_date).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : fallbackPrograms.length > 0 ? (
          // Fallback to old user_programs if no scheduled programs
          <div className="space-y-4">
            {fallbackPrograms.map((up) => (
              <Link
                key={up.program_id}
                href={`/programs/${up.program_id}`}
                className="block bg-zinc-900 border border-zinc-800 hover:border-yellow-400/50 rounded-2xl p-5 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-zinc-800 rounded-xl flex items-center justify-center text-3xl shrink-0">
                    
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-lg">{up.programs?.name || 'Program'}</h3>
                    <p className="text-zinc-500 text-sm mt-1 line-clamp-2">{up.programs?.description || ''}</p>
                    {up.programs?.type && (
                      <span className="inline-block mt-3 px-3 py-1 bg-yellow-400/20 text-yellow-400 text-xs font-medium rounded">
                        {up.programs.type}
                      </span>
                    )}
                  </div>
                  <span className="text-yellow-400 text-xl mt-2">→</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-white font-semibold text-lg mb-2">No Active Program</h3>
            <p className="text-zinc-400">
              Your coach will assign your next program soon.
            </p>
            <p className="text-zinc-600 text-sm mt-4">
              Check back later or contact your coach for updates.
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
