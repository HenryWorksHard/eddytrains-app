'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import BottomNav from '../../components/BottomNav'

export default function TodayWorkoutPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const findTodayWorkout = async () => {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const todayDayOfWeek = new Date().getDay()
      const today = new Date().toISOString().split('T')[0]

      const { data: clientPrograms } = await supabase
        .from('client_programs')
        .select(`
          id,
          programs (
            program_workouts (
              id,
              day_of_week,
              parent_workout_id
            )
          )
        `)
        .eq('client_id', user.id)
        .eq('is_active', true)
        .lte('start_date', today)
        .or(`end_date.gte.${today},end_date.is.null`)
        .order('start_date', { ascending: false })
        .limit(5)

      if (clientPrograms) {
        for (const cp of clientPrograms) {
          const program = (Array.isArray(cp.programs) ? cp.programs[0] : cp.programs) as {
            program_workouts?: { id: string; day_of_week: number | null; parent_workout_id: string | null }[]
          } | null

          if (program?.program_workouts) {
            const workout = program.program_workouts.find(
              w => w.day_of_week === todayDayOfWeek && !w.parent_workout_id
            )
            if (workout) {
              router.replace(`/workout/${workout.id}?clientProgramId=${cp.id}`)
              return
            }
          }
        }
      }

      // No workout today
      router.replace('/dashboard')
    }

    findTodayWorkout()
  }, [router])

  // Show loading skeleton immediately
  return (
    <div className="min-h-screen bg-black pb-24">
      <header className="bg-gradient-to-b from-zinc-900 to-black border-b border-zinc-800 animate-pulse">
        <div className="px-6 py-4">
          <div className="w-20 h-8 bg-zinc-800 rounded-lg"></div>
        </div>
        <div className="px-6 pb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-zinc-800 rounded-2xl"></div>
            <div className="flex-1">
              <div className="h-7 bg-zinc-800 rounded w-48 mb-2"></div>
              <div className="h-4 bg-zinc-800/60 rounded w-32 mb-2"></div>
              <div className="h-4 bg-zinc-800/40 rounded w-24"></div>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 py-6 animate-pulse">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-xl"></div>
                <div className="flex-1">
                  <div className="h-5 bg-zinc-800 rounded w-40 mb-2"></div>
                  <div className="h-4 bg-zinc-800/60 rounded w-28 mb-3"></div>
                  <div className="flex gap-4">
                    <div className="h-8 bg-zinc-800/40 rounded w-16"></div>
                    <div className="h-8 bg-zinc-800/40 rounded w-20"></div>
                    <div className="h-8 bg-zinc-800/40 rounded w-16"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
