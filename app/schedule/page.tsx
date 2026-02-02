import { createClient } from '../lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '../components/BottomNav'

export default async function SchedulePage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get all user schedules
  const { data: schedules } = await supabase
    .from('schedules')
    .select(`
      *,
      programs (name, emoji)
    `)
    .eq('user_id', user.id)

  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()

  // Group schedules by day
  const scheduleByDay = dayOrder.reduce((acc, day) => {
    acc[day] = schedules?.filter(s => s.day_of_week === day) || []
    return acc
  }, {} as Record<string, typeof schedules>)

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 bg-zinc-950/95 backdrop-blur-lg border-b border-zinc-800 z-40">
        <div className="px-6 py-4">
          <h1 className="text-xl font-bold text-white">Weekly Schedule</h1>
          <p className="text-gray-400 text-sm mt-1">Your training week at a glance</p>
        </div>
      </header>

      <main className="px-6 py-6">
        <div className="space-y-4">
          {dayOrder.map((day) => {
            const daySchedules = scheduleByDay[day]
            const isToday = day === today
            
            return (
              <div 
                key={day}
                className={`rounded-2xl border ${
                  isToday 
                    ? 'bg-gradient-to-r from-orange-500/10 to-orange-600/5 border-orange-500/30' 
                    : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className={`font-semibold capitalize ${isToday ? 'text-orange-500' : 'text-white'}`}>
                      {day}
                    </h3>
                    {isToday && (
                      <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-medium rounded-full">
                        Today
                      </span>
                    )}
                  </div>
                  
                  {daySchedules && daySchedules.length > 0 ? (
                    <div className="space-y-2">
                      {daySchedules.map((schedule) => (
                        <div 
                          key={schedule.id}
                          className={`flex items-center gap-3 p-3 rounded-xl ${
                            isToday ? 'bg-black/20' : 'bg-zinc-800/50'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                            isToday ? 'bg-orange-500/20' : 'bg-zinc-700'
                          }`}>
                            {schedule.programs?.emoji || '💪'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{schedule.workout_name}</p>
                            <p className="text-gray-500 text-sm truncate">{schedule.programs?.name}</p>
                          </div>
                          {schedule.duration && (
                            <span className="text-gray-400 text-sm shrink-0">{schedule.duration}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm py-2">Rest day 🎉</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
