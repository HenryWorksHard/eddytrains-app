import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  // Get stats
  const { count: userCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const { count: programCount } = await supabase
    .from('programs')
    .select('*', { count: 'exact', head: true })

  return (
    <div className="min-h-screen bg-black">
      {/* Header - Industrial Minimal */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-zinc-500 hover:text-yellow-400 text-sm transition-colors">← Back to App</Link>
            <div className="flex items-center gap-3 mt-2">
              <h1 className="text-2xl font-bold text-white tracking-widest" style={{ fontFamily: 'Sora, sans-serif' }}>CMPD ADMIN</h1>
              <div className="w-8 h-1 bg-yellow-400"></div>
            </div>
          </div>
          <div className="text-yellow-400 text-2xl">👑</div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <div className="text-4xl font-bold text-yellow-400">{userCount || 0}</div>
            <p className="text-zinc-500 mt-2">Total Users</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
            <div className="text-4xl font-bold text-white">{programCount || 0}</div>
            <p className="text-zinc-500 mt-2">Programs</p>
          </div>
        </div>

        {/* Quick Actions */}
        <section>
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Manage</h2>
          <div className="space-y-3">
            <Link
              href="/admin/users"
              className="flex items-center justify-between bg-zinc-900 border border-zinc-800 hover:border-yellow-400/50 rounded-2xl p-5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-400/20 rounded-xl flex items-center justify-center text-xl">
                  👥
                </div>
                <div>
                  <h3 className="font-semibold text-white">Users</h3>
                  <p className="text-zinc-500 text-sm">Add & manage client accounts</p>
                </div>
              </div>
              <span className="text-yellow-400">→</span>
            </Link>

            <Link
              href="/admin/programs"
              className="flex items-center justify-between bg-zinc-900 border border-zinc-800 hover:border-yellow-400/50 rounded-2xl p-5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center text-xl">
                  📋
                </div>
                <div>
                  <h3 className="font-semibold text-white">Programs</h3>
                  <p className="text-zinc-500 text-sm">Create & edit training programs</p>
                </div>
              </div>
              <span className="text-zinc-600">→</span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
