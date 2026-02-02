import { createClient } from '../../lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import BottomNav from '../../components/BottomNav'
import Link from 'next/link'

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Check user has access to this program
  const { data: userProgram } = await supabase
    .from('user_programs')
    .select(`
      *,
      programs (*)
    `)
    .eq('user_id', user.id)
    .eq('program_id', id)
    .single()

  if (!userProgram) {
    notFound()
  }

  const program = userProgram.programs as { name?: string; description?: string; emoji?: string; type?: string; content?: string }

  // Get schedule for this program
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_id', user.id)
    .eq('program_id', id)
    .order('day_of_week')

  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const sortedSchedules = schedules?.sort((a, b) => 
    dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week)
  )

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800">
        <div className="px-6 py-4">
          <Link href="/programs" className="text-orange-500 text-sm font-medium mb-2 inline-block">
            ← Back to Programs
          </Link>
        </div>
        <div className="px-6 pb-6">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 bg-zinc-800 rounded-2xl flex items-center justify-center text-4xl">
              {program?.emoji || '🏋️'}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">{program?.name || 'Program'}</h1>
              {program?.type && (
                <span className="inline-block mt-2 px-3 py-1 bg-orange-500/10 text-orange-500 text-xs font-medium rounded-full">
                  {program.type}
                </span>
              )}
            </div>
          </div>
          {program?.description && (
            <p className="text-gray-400 mt-4">{program.description}</p>
          )}
        </div>
      </header>

      <main className="px-6 py-6 space-y-8">
        {/* Weekly Schedule */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Weekly Schedule</h2>
          {sortedSchedules && sortedSchedules.length > 0 ? (
            <div className="space-y-3">
              {sortedSchedules.map((schedule) => (
                <div 
                  key={schedule.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-500 text-sm font-medium capitalize">
                        {schedule.day_of_week}
                      </p>
                      <h3 className="text-white font-medium mt-1">{schedule.workout_name}</h3>
                      {schedule.notes && (
                        <p className="text-gray-500 text-sm mt-1">{schedule.notes}</p>
                      )}
                    </div>
                    {schedule.duration && (
                      <span className="text-gray-400 text-sm">{schedule.duration}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <p className="text-gray-400">No schedule set for this program yet.</p>
            </div>
          )}
        </section>

        {/* Program Content/Notes */}
        {program?.content && (
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">Program Details</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="text-gray-300 whitespace-pre-wrap">{program.content}</div>
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
