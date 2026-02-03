import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserPermissions, hasAccess } from '../lib/permissions'
import BottomNav from '../components/BottomNav'
import Link from 'next/link'

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic'

interface ProgramWorkout {
  id: string
  name: string
  day_of_week: number | null
  order_index: number
  program_id: string
}

export default async function ProgramsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Check permissions
  const permissions = await getUserPermissions()
  if (!hasAccess(permissions, 'can_access_strength')) {
    return (
      <div className="min-h-screen bg-black pb-32">
        <header className="bg-zinc-900 border-b border-zinc-800">
          <div className="px-6 py-6">
            <h1 className="text-2xl font-bold text-white">Programs</h1>
          </div>
        </header>
        <main className="px-6 py-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Programs Not Enabled</h2>
            <p className="text-zinc-400">Contact your coach to enable program access for your account.</p>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Get ALL user's active programs (where today is between start_date and end_date)
  const { data: activePrograms } = await supabase
    .from('client_programs')
    .select(`
      *,
      program:programs (*)
    `)
    .eq('client_id', user.id)
    .eq('is_active', true)
    .lte('start_date', today)
    .or(`end_date.gte.${today},end_date.is.null`)
    .order('start_date', { ascending: false })

  const clientPrograms = activePrograms || []
  const currentProgram = clientPrograms[0] || null

  // Fetch program workouts for ALL active programs
  const allProgramIds = clientPrograms.map(cp => cp.program_id).filter(Boolean)
  let programWorkoutsMap: Record<string, ProgramWorkout[]> = {}
  
  if (allProgramIds.length > 0) {
    const { data: workoutsData } = await supabase
      .from('program_workouts')
      .select('id, name, day_of_week, order_index, program_id')
      .in('program_id', allProgramIds)
      .order('order_index')
    
    // Group workouts by program_id
    const workouts: ProgramWorkout[] = workoutsData || []
    workouts.forEach(w => {
      if (!programWorkoutsMap[w.program_id]) {
        programWorkoutsMap[w.program_id] = []
      }
      programWorkoutsMap[w.program_id].push(w)
    })
  }
  
  // For backwards compatibility
  const programWorkouts = currentProgram ? (programWorkoutsMap[currentProgram.program_id] || []) : []

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

  // Calculate progress for any program
  const getProgress = (cp: typeof currentProgram) => {
    if (!cp) return null
    const start = new Date(cp.start_date)
    const end = cp.end_date ? new Date(cp.end_date) : null
    const now = new Date()
    
    if (!end) return null
    
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const daysElapsed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const weeksElapsed = Math.ceil(daysElapsed / 7)
    const totalWeeks = cp.duration_weeks || Math.ceil(totalDays / 7)
    
    return {
      week: Math.min(weeksElapsed, totalWeeks),
      totalWeeks,
      percentage: Math.min(Math.round((daysElapsed / totalDays) * 100), 100),
      daysRemaining: Math.max(0, totalDays - daysElapsed)
    }
  }

  const progress = getProgress(currentProgram)

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header - Industrial Minimal */}
      <header className="sticky top-0 bg-black/95 backdrop-blur-lg border-b border-zinc-800 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-widest" style={{ fontFamily: 'Sora, sans-serif' }}>YOUR PROGRAMS</h1>
            <div className="w-8 h-1 bg-yellow-400"></div>
          </div>
          <p className="text-zinc-500 text-sm mt-1">Active training programs</p>
        </div>
      </header>

      <main className="px-6 py-6">
        {clientPrograms.length > 0 ? (
          <div className="space-y-6">
            {/* All Active Programs */}
            {clientPrograms.map((cp, programIdx) => {
              const prog = cp.program
              const cpProgress = getProgress(cp)
              const cpWorkouts = programWorkoutsMap[cp.program_id] || []
              
              return (
                <div key={cp.id} className="space-y-4">
                  {/* Program Card */}
                  <div className={`bg-zinc-900 border ${programIdx === 0 ? 'border-yellow-400/30' : 'border-zinc-800'} rounded-2xl p-6`}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-2 py-1 bg-yellow-400 text-black text-xs font-bold rounded">
                        ACTIVE
                      </span>
                      {cpProgress && (
                        <span className="text-zinc-500 text-sm">
                          Week {cpProgress.week} of {cpProgress.totalWeeks}
                        </span>
                      )}
                      {prog?.category && (
                        <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded capitalize">
                          {prog.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 bg-yellow-400/10 rounded-xl flex items-center justify-center text-3xl shrink-0">
                        {prog?.emoji || '💪'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white text-xl">{prog?.name || 'Program'}</h3>
                        {cp.phase_name && (
                          <p className="text-yellow-400/80 text-sm mt-1">{cp.phase_name}</p>
                        )}
                        <p className="text-zinc-400 text-sm mt-1 line-clamp-2">{prog?.description || ''}</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {cpProgress && (
                      <div className="mt-6">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-zinc-500">Progress</span>
                          <span className="text-yellow-400 font-medium">{cpProgress.percentage}%</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                            style={{ width: `${cpProgress.percentage}%` }}
                          />
                        </div>
                        <p className="text-zinc-600 text-xs mt-2">
                          {cpProgress.daysRemaining > 0 
                            ? `${cpProgress.daysRemaining} days remaining`
                            : 'Completing soon!'
                          }
                        </p>
                      </div>
                    )}

                    {/* Schedule Info */}
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-zinc-500">Started</p>
                          <p className="text-white font-medium">
                            {new Date(cp.start_date).toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short'
                            })}
                          </p>
                        </div>
                        {cp.end_date && (
                          <div>
                            <p className="text-zinc-500">Ends</p>
                            <p className="text-white font-medium">
                              {new Date(cp.end_date).toLocaleDateString('en-AU', {
                                day: 'numeric',
                                month: 'short'
                              })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Workouts List for this program */}
                  {cpWorkouts.length > 0 && (
                    <div className="space-y-2">
                      {cpWorkouts.map((workout, idx) => (
                        <Link
                          key={workout.id}
                          href={`/workout/${workout.id}?clientProgramId=${cp.id}`}
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
                </div>
              )
            })}
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
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-zinc-600">?</span>
            </div>
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
