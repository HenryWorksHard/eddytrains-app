import { createClient } from '@/app/lib/supabase/server'
import Link from 'next/link'
import { Bell, AlertTriangle, Trophy, Flame, CheckCircle, Clock, X, RefreshCw, User } from 'lucide-react'
import { DismissButton, MarkReadButton, RunCronButton, DismissAllButton } from './AlertButtons'

export const dynamic = 'force-dynamic'

interface Notification {
  id: string
  client_id: string
  type: 'missed_workout' | 'new_pr' | 'streak_achieved' | 'streak_lost' | 'milestone'
  title: string
  message: string
  metadata: Record<string, unknown>
  is_read: boolean
  is_dismissed: boolean
  created_at: string
  profiles?: {
    id: string
    email: string
    full_name: string | null
  }
}

interface Streak {
  id: string
  client_id: string
  current_streak: number
  longest_streak: number
  last_workout_date: string | null
  profiles?: {
    full_name: string | null
    email: string
  }
}

async function getNotifications() {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('admin_notifications')
    .select(`
      *,
      profiles:client_id (id, email, full_name)
    `)
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    .limit(50)

  return (data || []) as Notification[]
}

async function getStats() {
  const supabase = await createClient()
  
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  
  // Count notifications by type in last 7 days
  const { data: recentNotifs } = await supabase
    .from('admin_notifications')
    .select('type')
    .gte('created_at', sevenDaysAgo.toISOString())

  const stats = {
    missedWorkouts: 0,
    newPRs: 0,
    streakAchievements: 0,
    streaksLost: 0,
  }

  recentNotifs?.forEach(n => {
    if (n.type === 'missed_workout') stats.missedWorkouts++
    if (n.type === 'new_pr') stats.newPRs++
    if (n.type === 'streak_achieved') stats.streakAchievements++
    if (n.type === 'streak_lost') stats.streaksLost++
  })

  return stats
}

async function getTopStreaks() {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('client_streaks')
    .select(`
      *,
      profiles:client_id (full_name, email)
    `)
    .gt('current_streak', 0)
    .order('current_streak', { ascending: false })
    .limit(5)

  return (data || []) as Streak[]
}

async function getRecentPRs() {
  const supabase = await createClient()
  
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  
  const { data } = await supabase
    .from('personal_records')
    .select(`
      *,
      profiles:client_id (full_name, email)
    `)
    .gte('achieved_at', sevenDaysAgo.toISOString())
    .order('achieved_at', { ascending: false })
    .limit(10)

  return data || []
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'missed_workout':
      return <AlertTriangle className="w-5 h-5 text-orange-400" />
    case 'new_pr':
      return <Trophy className="w-5 h-5 text-yellow-400" />
    case 'streak_achieved':
      return <Flame className="w-5 h-5 text-green-400" />
    case 'streak_lost':
      return <X className="w-5 h-5 text-red-400" />
    default:
      return <Bell className="w-5 h-5 text-blue-400" />
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case 'missed_workout':
      return 'bg-orange-500/10 border-orange-500/20'
    case 'new_pr':
      return 'bg-yellow-500/10 border-yellow-500/20'
    case 'streak_achieved':
      return 'bg-green-500/10 border-green-500/20'
    case 'streak_lost':
      return 'bg-red-500/10 border-red-500/20'
    default:
      return 'bg-blue-500/10 border-blue-500/20'
  }
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default async function AlertsPage() {
  const [notifications, stats, topStreaks, recentPRs] = await Promise.all([
    getNotifications(),
    getStats(),
    getTopStreaks(),
    getRecentPRs(),
  ])

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Bell className="w-8 h-8 text-yellow-400" />
            Alerts & Notifications
          </h1>
          <p className="text-zinc-400 mt-1">
            {unreadCount > 0 
              ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All caught up!'}
          </p>
        </div>
        <div className="flex gap-3">
          <DismissAllButton />
          <RunCronButton />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 border-l-4 border-orange-400">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-orange-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.missedWorkouts}</p>
              <p className="text-sm text-zinc-400">Missed Workouts (7d)</p>
            </div>
          </div>
        </div>
        <div className="card p-4 border-l-4 border-yellow-400">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.newPRs}</p>
              <p className="text-sm text-zinc-400">New PRs (7d)</p>
            </div>
          </div>
        </div>
        <div className="card p-4 border-l-4 border-green-400">
          <div className="flex items-center gap-3">
            <Flame className="w-8 h-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.streakAchievements}</p>
              <p className="text-sm text-zinc-400">Streak Milestones (7d)</p>
            </div>
          </div>
        </div>
        <div className="card p-4 border-l-4 border-red-400">
          <div className="flex items-center gap-3">
            <X className="w-8 h-8 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.streaksLost}</p>
              <p className="text-sm text-zinc-400">Streaks Lost (7d)</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Notifications List - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold text-white">Recent Notifications</h2>
          
          {notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`card p-4 border ${getTypeColor(notification.type)} ${
                    !notification.is_read ? 'ring-1 ring-yellow-400/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1">{getTypeIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white truncate">
                          {notification.title}
                        </h3>
                        {!notification.is_read && (
                          <span className="px-2 py-0.5 bg-yellow-400 text-black text-xs font-medium rounded-full">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 mb-2">{notification.message}</p>
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(notification.created_at)}
                        </span>
                        {notification.profiles && (
                          <Link 
                            href={`/users/${notification.client_id}`}
                            className="flex items-center gap-1 hover:text-yellow-400 transition-colors"
                          >
                            <User className="w-3 h-3" />
                            {notification.profiles.full_name || notification.profiles.email}
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.is_read && (
                        <MarkReadButton notificationId={notification.id} />
                      )}
                      <DismissButton notificationId={notification.id} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">All Clear!</h3>
              <p className="text-zinc-400">No notifications at the moment. Your clients are doing great!</p>
            </div>
          )}
        </div>

        {/* Sidebar - Streaks & PRs */}
        <div className="space-y-6">
          {/* Top Streaks */}
          <div className="card">
            <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-400" />
              <h2 className="font-semibold text-white">Top Streaks</h2>
            </div>
            {topStreaks.length > 0 ? (
              <div className="divide-y divide-zinc-800">
                {topStreaks.map((streak, idx) => (
                  <Link
                    key={streak.id}
                    href={`/users/${streak.client_id}`}
                    className="flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        idx === 0 ? 'bg-yellow-400 text-black' :
                        idx === 1 ? 'bg-zinc-400 text-black' :
                        idx === 2 ? 'bg-orange-600 text-white' :
                        'bg-zinc-700 text-white'
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <span className="font-medium text-white block">
                          {streak.profiles?.full_name || streak.profiles?.email?.split('@')[0]}
                        </span>
                        <span className="text-xs text-zinc-500">
                          Best: {streak.longest_streak} days
                        </span>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-orange-400 font-semibold">
                      <Flame className="w-4 h-4" />
                      {streak.current_streak}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Flame className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">No active streaks yet</p>
              </div>
            )}
          </div>

          {/* Recent PRs */}
          <div className="card">
            <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <h2 className="font-semibold text-white">Recent PRs (7d)</h2>
            </div>
            {recentPRs.length > 0 ? (
              <div className="divide-y divide-zinc-800">
                {recentPRs.map((pr: { id: string; client_id: string; exercise_name: string; weight_kg: number; reps: number; estimated_1rm: number; profiles?: { full_name?: string; email?: string } }) => (
                  <Link
                    key={pr.id}
                    href={`/users/${pr.client_id}`}
                    className="block p-4 hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-white">
                        {pr.profiles?.full_name || pr.profiles?.email?.split('@')[0]}
                      </span>
                      <span className="text-yellow-400 font-semibold">
                        {pr.weight_kg}kg × {pr.reps}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">{pr.exercise_name}</span>
                      <span className="text-zinc-500">~{Math.round(pr.estimated_1rm)}kg 1RM</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Trophy className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">No PRs this week</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
