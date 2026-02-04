import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserPermissions, hasAccess } from '../lib/permissions'
import BottomNav from '../components/BottomNav'
import Link from 'next/link'
import ProgramsClient from './ProgramsClient'

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic'

interface ProgramWorkout {
  id: string
  name: string
  day_of_week: number | null
  order_index: number
  program_id: string
  finisher?: {
    id: string
    name: string
  } | null
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
      .select('id, name, day_of_week, order_index, program_id, parent_workout_id')
      .in('program_id', allProgramIds)
      .order('order_index')
    
    // Group workouts by program_id, separating main workouts from finishers
    const allWorkouts = workoutsData || []
    const finishersByParent: Record<string, typeof allWorkouts> = {}
    
    // First pass: identify finishers
    allWorkouts.forEach(w => {
      if (w.parent_workout_id) {
        if (!finishersByParent[w.parent_workout_id]) {
          finishersByParent[w.parent_workout_id] = []
        }
        finishersByParent[w.parent_workout_id].push(w)
      }
    })
    
    // Second pass: add main workouts with their finishers attached
    allWorkouts.forEach(w => {
      // Skip finishers - they'll be nested under parent
      if (w.parent_workout_id) return
      
      if (!programWorkoutsMap[w.program_id]) {
        programWorkoutsMap[w.program_id] = []
      }
      
      // Add finisher info if this workout has one
      const finishers = finishersByParent[w.id] || []
      programWorkoutsMap[w.program_id].push({
        ...w,
        finisher: finishers[0] || null // Attach first finisher
      } as any)
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
          <ProgramsClient 
            clientPrograms={clientPrograms.map(cp => ({
              ...cp,
              program: Array.isArray(cp.program) ? cp.program[0] : cp.program
            }))}
            programWorkoutsMap={programWorkoutsMap}
          />
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
