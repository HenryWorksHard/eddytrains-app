'use client'

import { useRouter } from 'next/navigation'
import { Lock, Mail } from 'lucide-react'
import { createClient } from '@/app/lib/supabase/client'

export default function AccessPausedPage() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-orange-500/15 flex items-center justify-center mb-6">
            <Lock className="w-8 h-8 text-orange-400" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-3">
            Your access is paused
          </h1>

          <p className="text-zinc-400 mb-2">
            Your trainer has paused your access to the app.
          </p>
          <p className="text-zinc-400 mb-8">
            Please reach out to them directly to resume your account.
          </p>

          <div className="space-y-3">
            <a
              href="mailto:contact@cmpdcollective.com"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors"
            >
              <Mail className="w-4 h-4" />
              Contact support
            </a>

            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-xl transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
