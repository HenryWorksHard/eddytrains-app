import { createClient } from '@/app/lib/supabase/server'
import { getEffectiveOrgId } from '@/app/lib/org-context'
import Link from 'next/link'
import { Users, Dumbbell, Calendar, Activity, TrendingUp, UserPlus, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import OnboardingBanner from '@/components/OnboardingBanner'
import TrialExpiryBanner from '@/components/TrialExpiryBanner'
import Sidebar from '@/components/Sidebar'

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic'

async function getOrgInfo() {
  const supabase = await createClient()
  
  const orgId = await getEffectiveOrgId()
  if (!orgId) return null

  const { data: org } = await supabase
    .from('organizations')
    .select('name, subscription_tier, subscription_status, trial_ends_at, logo_url')
    .eq('id', orgId)
    .single()

  if (!org) return null

  let trialDaysRemaining = 0
  if (org.subscription_status === 'trialing' && org.trial_ends_at) {
    const trialEnd = new Date(org.trial_ends_at)
    const now = new Date()
    trialDaysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  }

  return {
    name: org.name,
    tier: org.subscription_tier,
    status: org.subscription_status,
    trialDaysRemaining,
    hasLogo: !!org.logo_url,
    organizationId: orgId,
  }
}

async function getOnboardingStatus(organizationId: string) {
  const supabase = await createClient()
  
  const { count: programCount } = await supabase
    .from('programs')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
  
  const { count: clientCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('role', 'client')
  
  return {
    hasProgram: (programCount || 0) > 0,
    hasClient: (clientCount || 0) > 0,
  }
}

interface UserWithActivity {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  lastWorkout?: string
  completionRate?: number
  missedDays?: number
}

async function getStats(orgId: string | null) {
  if (!orgId) return { totalUsers: 0, totalPrograms: 0, totalSchedules: 0, activeToday: 0, weeklyCompletions: 0 }
  
  const supabase = await createClient()
  
  const [usersResult, programsResult, schedulesResult] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'client').eq('organization_id', orgId),
    supabase.from('programs').select('id', { count: 'exact' }).eq('organization_id', orgId),
    supabase.from('schedules').select('id', { count: 'exact' }).eq('organization_id', orgId),
  ])

  const { data: orgClients } = await supabase
    .from('profiles')
    .select('id')
    .eq('organization_id', orgId)
    .eq('role', 'client')
  
  const clientIds = orgClients?.map(c => c.id) || []
  
  const today = new Date().toISOString().split('T')[0]
  let uniqueActiveToday = 0
  if (clientIds.length > 0) {
    const { data: activeToday } = await supabase
      .from('workout_completions')
      .select('client_id')
      .eq('scheduled_date', today)
      .in('client_id', clientIds)
    
    uniqueActiveToday = new Set(activeToday?.map(a => a.client_id) || []).size
  }

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  
  let completionCount = 0
  if (clientIds.length > 0) {
    const { count } = await supabase
      .from('workout_completions')
      .select('*', { count: 'exact', head: true })
      .gte('scheduled_date', weekAgo.toISOString().split('T')[0])
      .in('client_id', clientIds)
    
    completionCount = count || 0
  }

  return {
    totalUsers: usersResult.count || 0,
    totalPrograms: programsResult.count || 0,
    totalSchedules: schedulesResult.count || 0,
    activeToday: uniqueActiveToday,
    weeklyCompletions: completionCount,
  }
}

async function getRecentUsers(orgId: string | null) {
  if (!orgId) return []
  
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, created_at, is_active')
    .eq('role', 'client')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(5)
  
  return data || []
}

async function getUsersNeedingAttention(orgId: string | null) {
  if (!orgId) return []
  
  const supabase = await createClient()
  
  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, full_name, is_active')
    .eq('role', 'client')
    .eq('organization_id', orgId)
    .eq('is_active', true)
  
  if (!users || users.length === 0) return []

  const userIds = users.map(u => u.id)
  
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  
  const { data: recentCompletions } = await supabase
    .from('workout_completions')
    .select('client_id, scheduled_date')
    .in('client_id', userIds)
    .gte('scheduled_date', twoWeeksAgo.toISOString().split('T')[0])
    .order('scheduled_date', { ascending: false })

  const lastWorkoutMap = new Map<string, string>()
  recentCompletions?.forEach(c => {
    if (!lastWorkoutMap.has(c.client_id)) {
      lastWorkoutMap.set(c.client_id, c.scheduled_date)
    }
  })

  const today = new Date()
  const usersNeedingAttention: UserWithActivity[] = []
  
  users.forEach(user => {
    const lastWorkout = lastWorkoutMap.get(user.id)
    if (!lastWorkout) {
      usersNeedingAttention.push({
        ...user,
        missedDays: 14,
        lastWorkout: undefined
      })
    } else {
      const lastDate = new Date(lastWorkout)
      const daysSince = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      if (daysSince >= 5) {
        usersNeedingAttention.push({
          ...user,
          missedDays: daysSince,
          lastWorkout
        })
      }
    }
  })

  return usersNeedingAttention.sort((a, b) => (b.missedDays || 0) - (a.missedDays || 0)).slice(0, 5)
}

async function getTopPerformers(orgId: string | null) {
  if (!orgId) return []
  
  const supabase = await createClient()
  
  const { data: orgClients } = await supabase
    .from('profiles')
    .select('id')
    .eq('organization_id', orgId)
    .eq('role', 'client')
  
  const clientIds = orgClients?.map(c => c.id) || []
  if (clientIds.length === 0) return []
  
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  
  const { data: completions } = await supabase
    .from('workout_completions')
    .select('client_id')
    .gte('scheduled_date', weekAgo.toISOString().split('T')[0])
    .in('client_id', clientIds)

  const counts = new Map<string, number>()
  completions?.forEach(c => {
    counts.set(c.client_id, (counts.get(c.client_id) || 0) + 1)
  })

  const topUserIds = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  if (topUserIds.length === 0) return []

  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', topUserIds)

  return topUserIds.map(id => {
    const user = users?.find(u => u.id === id)
    return {
      id,
      email: user?.email || '',
      full_name: user?.full_name || null,
      completions: counts.get(id) || 0
    }
  })
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: { welcome?: string }
}) {
  const isWelcome = searchParams.welcome === 'true'
  
  const orgInfo = await getOrgInfo()
  const orgId = orgInfo?.organizationId || null
  
  const [stats, recentUsers, usersNeedingAttention, topPerformers] = await Promise.all([
    getStats(orgId),
    getRecentUsers(orgId),
    getUsersNeedingAttention(orgId),
    getTopPerformers(orgId),
  ])
  
  const onboarding = orgId 
    ? await getOnboardingStatus(orgId)
    : { hasProgram: false, hasClient: false }
  
  const onboardingComplete = orgInfo?.hasLogo && onboarding.hasProgram && onboarding.hasClient
  const showChecklist = orgInfo?.status === 'trialing' && !onboardingComplete
  const showSetupComplete = orgInfo?.status === 'trialing' && onboardingComplete

  const statCards = [
    { name: 'Total Clients', value: stats.totalUsers, icon: Users, color: 'from-blue-500 to-cyan-500', href: '/users' },
    { name: 'Programs', value: stats.totalPrograms, icon: Dumbbell, color: 'from-yellow-400 to-yellow-500', href: '/programs' },
    { name: 'Active Today', value: stats.activeToday, icon: Activity, color: 'from-green-500 to-emerald-500', href: '/users' },
    { name: 'Weekly Completions', value: stats.weeklyCompletions, icon: CheckCircle, color: 'from-purple-500 to-pink-500', href: '/users' },
  ]

  const checklistItems = [
    { 
      label: 'Add your logo & customize branding', 
      href: '/organisation', 
      complete: orgInfo?.hasLogo || false 
    },
    { 
      label: 'Create your first program', 
      href: '/programs/new', 
      complete: onboarding.hasProgram 
    },
    { 
      label: 'Invite your first client', 
      href: '/users/new', 
      complete: onboarding.hasClient 
    },
  ]

  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="lg:ml-64 p-4 lg:p-8 pt-4 lg:pt-8">
        <div className="space-y-8">
          {/* Subscription Canceled Banner */}
          {orgInfo?.status === 'canceled' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span className="text-zinc-300">
                  <span className="font-semibold text-red-400">Subscription Canceled</span> — Resubscribe to regain full access
                </span>
              </div>
              <Link href="/billing" className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white font-medium rounded-lg transition-colors text-sm">
                Resubscribe
              </Link>
            </div>
          )}

          {/* Trial Expiry Warning */}
          {orgInfo?.status === 'trialing' && orgInfo.trialDaysRemaining <= 3 && (
            <TrialExpiryBanner daysRemaining={orgInfo.trialDaysRemaining} />
          )}

          {/* Onboarding Banner */}
          {(isWelcome || showChecklist || showSetupComplete) && orgInfo && (
            <OnboardingBanner
              checklistItems={checklistItems}
              trialDaysRemaining={orgInfo.trialDaysRemaining}
              isWelcome={isWelcome}
              hasClient={onboarding.hasClient}
              hasProgram={onboarding.hasProgram}
            />
          )}

          {/* Trial Status Banner */}
          {orgInfo?.status === 'trialing' && !showChecklist && !showSetupComplete && !isWelcome && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-400" />
                <span className="text-zinc-300">
                  <span className="font-semibold text-blue-400">{orgInfo.trialDaysRemaining} days</span> left — full access to all features
                </span>
              </div>
              <Link href="/billing" className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white font-medium rounded-lg transition-colors text-sm">
                Choose Plan
              </Link>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Dashboard</h1>
              <p className="text-zinc-400 mt-1">Welcome back! Here&apos;s what&apos;s happening.</p>
            </div>
            <Link
              href="/users/new"
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-xl font-medium transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              Add Client
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((stat) => (
              <Link
                key={stat.name}
                href={stat.href}
                className="card p-6 group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-zinc-400">{stat.name}</p>
              </Link>
            ))}
          </div>

          {/* Recent Clients */}
          <div className="card">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Recent Clients</h2>
              <Link
                href="/users"
                className="text-sm text-yellow-400 hover:text-yellow-300 font-medium"
              >
                View all →
              </Link>
            </div>
            {recentUsers.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-white font-medium text-sm">
                              {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                            </div>
                            <span className="font-medium text-white">{user.full_name || 'No name'}</span>
                          </div>
                        </td>
                        <td>{user.email}</td>
                        <td>
                          <span className={`badge ${user.is_active ? 'badge-success' : 'badge-error'}`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="text-zinc-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">No clients yet. Add your first client to get started.</p>
                <Link
                  href="/users/new"
                  className="inline-flex items-center gap-2 mt-4 text-yellow-400 hover:text-yellow-300 font-medium"
                >
                  <UserPlus className="w-5 h-5" />
                  Add Client
                </Link>
              </div>
            )}
          </div>

          {/* Analytics Row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Users Needing Attention */}
            <div className="card">
              <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                <h2 className="text-lg font-semibold text-white">Needs Attention</h2>
              </div>
              {usersNeedingAttention.length > 0 ? (
                <div className="divide-y divide-zinc-800">
                  {usersNeedingAttention.map((user) => (
                    <Link
                      key={user.id}
                      href={`/users/${user.id}`}
                      className="flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-medium text-sm">
                          {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-white block">{user.full_name || user.email.split('@')[0]}</span>
                          <span className="text-xs text-zinc-500">{user.email}</span>
                        </div>
                      </div>
                      <span className="text-orange-400 text-sm font-medium">
                        {user.missedDays}+ days inactive
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <p className="text-zinc-400 text-sm">All clients are on track! 🎉</p>
                </div>
              )}
            </div>

            {/* Top Performers */}
            <div className="card">
              <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <h2 className="text-lg font-semibold text-white">Top Performers (This Week)</h2>
              </div>
              {topPerformers.length > 0 ? (
                <div className="divide-y divide-zinc-800">
                  {topPerformers.map((user, index) => (
                    <Link
                      key={user.id}
                      href={`/users/${user.id}`}
                      className="flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0 ? 'bg-yellow-400 text-black' :
                          index === 1 ? 'bg-zinc-400 text-black' :
                          index === 2 ? 'bg-orange-600 text-white' :
                          'bg-zinc-700 text-white'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <span className="font-medium text-white block">{user.full_name || user.email.split('@')[0]}</span>
                          <span className="text-xs text-zinc-500">{user.email}</span>
                        </div>
                      </div>
                      <span className="text-green-400 text-sm font-medium">
                        {user.completions} workouts
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Dumbbell className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400 text-sm">No workout completions this week yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-3 gap-6">
            <Link href="/users/new" className="card p-6 group hover:border-yellow-400/50">
              <UserPlus className="w-8 h-8 text-yellow-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-yellow-400 transition-colors">Add New Client</h3>
              <p className="text-zinc-400 text-sm">Invite a new client and assign them programs</p>
            </Link>
            <Link href="/programs/new" className="card p-6 group hover:border-yellow-400/50">
              <Dumbbell className="w-8 h-8 text-yellow-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-yellow-400 transition-colors">Create Program</h3>
              <p className="text-zinc-400 text-sm">Build a new workout program for your clients</p>
            </Link>
            <Link href="/schedules" className="card p-6 group hover:border-yellow-400/50">
              <Calendar className="w-8 h-8 text-yellow-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-yellow-400 transition-colors">View Schedules</h3>
              <p className="text-zinc-400 text-sm">Manage client workout schedules</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
