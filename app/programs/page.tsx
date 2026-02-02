import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '../components/BottomNav'
import Link from 'next/link'

export default async function ProgramsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user's assigned programs with full details
  const { data: userPrograms } = await supabase
    .from('user_programs')
    .select(`
      *,
      programs (*)
    `)
    .eq('user_id', user.id)

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 bg-zinc-950/95 backdrop-blur-lg border-b border-zinc-800 z-40">
        <div className="px-6 py-4">
          <h1 className="text-xl font-bold text-white">My Programs</h1>
          <p className="text-gray-400 text-sm mt-1">Your assigned training programs</p>
        </div>
      </header>

      <main className="px-6 py-6">
        {userPrograms && userPrograms.length > 0 ? (
          <div className="space-y-4">
            {userPrograms.map((up: { program_id: string; programs?: { name?: string; description?: string; emoji?: string; type?: string } }) => (
              <Link
                key={up.program_id}
                href={`/programs/${up.program_id}`}
                className="block bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-zinc-800 rounded-xl flex items-center justify-center text-3xl shrink-0">
                    {up.programs?.emoji || '🏋️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-lg">{up.programs?.name || 'Program'}</h3>
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">{up.programs?.description || ''}</p>
                    {up.programs?.type && (
                      <span className="inline-block mt-3 px-3 py-1 bg-orange-500/10 text-orange-500 text-xs font-medium rounded-full">
                        {up.programs.type}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-600 text-xl mt-2">→</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-white font-semibold text-lg mb-2">No Programs Yet</h3>
            <p className="text-gray-400">
              Your coach will assign programs to you soon.
            </p>
            <p className="text-gray-500 text-sm mt-4">
              Once assigned, your training programs will appear here.
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
