'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'
import { useTheme } from './ThemeProvider'
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  Calendar,
  Settings,
  LogOut,
  ChevronRight,
  Apple,
  Bell,
  Sun,
  Moon,
  CreditCard,
  Building2,
  Shield,
  UserCheck,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'

// Super Admin nav (Louis only - platform control)
const superAdminNavItems = [
  { name: 'Platform', href: '/platform', icon: Shield },
  { name: 'Companies', href: '/platform/companies', icon: Building2 },
  { name: 'Trainers', href: '/platform/trainers', icon: UserCheck },
  { name: 'Settings', href: '/settings', icon: Settings },
]

// Company Admin nav (gym owners - no billing, just management)
const companyAdminNavItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Trainers', href: '/company/trainers', icon: UserCheck },
  { name: 'All Clients', href: '/company/clients', icon: Users },
  { name: 'Programs', href: '/programs', icon: Dumbbell },
  { name: 'Settings', href: '/settings', icon: Settings },
]

// Trainer nav (under company - no billing)
const trainerNavItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clients', href: '/users', icon: Users },
  { name: 'Programs', href: '/programs', icon: Dumbbell },
  { name: 'Nutrition', href: '/nutrition', icon: Apple },
  { name: 'Settings', href: '/settings', icon: Settings },
]

// Solo trainer gets billing option
const soloTrainerNavItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clients', href: '/users', icon: Users },
  { name: 'Programs', href: '/programs', icon: Dumbbell },
  { name: 'Nutrition', href: '/nutrition', icon: Apple },
  { name: 'Billing', href: '/billing', icon: CreditCard },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [userRole, setUserRole] = useState<string>('trainer')
  const [isSoloTrainer, setIsSoloTrainer] = useState(false)
  const [orgName, setOrgName] = useState<string>('CMPD')
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [impersonatedOrgName, setImpersonatedOrgName] = useState<string>('')
  const [isTrialing, setIsTrialing] = useState(false)
  const [trialDaysLeft, setTrialDaysLeft] = useState(0)
  const [hasPlanSelected, setHasPlanSelected] = useState(false)
  const [selectedTier, setSelectedTier] = useState<string>('')

  useEffect(() => {
    setMounted(true)
    
    // Check for impersonation
    const impersonatingOrgId = sessionStorage.getItem('impersonating_org')
    if (impersonatingOrgId) {
      setIsImpersonating(true)
      supabase
        .from('organizations')
        .select('name')
        .eq('id', impersonatingOrgId)
        .single()
        .then(({ data }) => {
          if (data?.name) {
            setImpersonatedOrgName(data.name)
          }
        })
    }
    
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, organization_id, company_id')
          .eq('id', user.id)
          .single()
        
        if (error || !profile) {
          console.log('User profile not found, signing out...')
          await supabase.auth.signOut()
          router.push('/login')
          return
        }
        
        setUserRole(profile?.role || 'trainer')
        
        // Check if trainer is solo (no company_id) or under a company
        if (profile?.role === 'trainer') {
          setIsSoloTrainer(!profile.company_id)
        }
        
        // Fetch org name and subscription status
        if (profile?.organization_id && profile?.role !== 'super_admin') {
          const { data: org } = await supabase
            .from('organizations')
            .select('name, subscription_status, trial_ends_at, stripe_subscription_id, subscription_tier, organization_type')
            .eq('id', profile.organization_id)
            .single()
          
          if (org?.name) {
            setOrgName(org.name)
          }
          
          // Only show trial banner for solo trainers
          if (org?.organization_type === 'solo' && org?.subscription_status === 'trialing') {
            setIsTrialing(true)
            if (org?.trial_ends_at) {
              const trialEnd = new Date(org.trial_ends_at)
              const now = new Date()
              const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
              setTrialDaysLeft(daysLeft)
            }
            if (org?.stripe_subscription_id) {
              setHasPlanSelected(true)
              setSelectedTier(org?.subscription_tier || '')
            }
          }
        }
      }
    }
    checkRole()
  }, [supabase, router])
  
  // Determine which nav items to show
  const getNavItems = () => {
    if (isImpersonating) {
      return trainerNavItems // When impersonating, show trainer view
    }
    switch (userRole) {
      case 'super_admin':
        return superAdminNavItems
      case 'company_admin':
        return companyAdminNavItems
      case 'trainer':
        return isSoloTrainer ? soloTrainerNavItems : trainerNavItems
      default:
        return trainerNavItems
    }
  }
  
  const navItems = getNavItems()
  
  const getPortalLabel = () => {
    if (isImpersonating) return 'Viewing as Trainer'
    switch (userRole) {
      case 'super_admin': return 'Super Admin'
      case 'company_admin': return 'Company Portal'
      case 'trainer': return isSoloTrainer ? 'Trainer Portal' : 'Trainer'
      default: return 'Portal'
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleBackToPlatform = async () => {
    await fetch('/api/impersonate', { method: 'DELETE' })
    sessionStorage.removeItem('impersonating_org')
    router.push('/platform')
    router.refresh()
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col z-40">
      {/* Back to Platform button when impersonating */}
      {isImpersonating && (
        <button
          onClick={handleBackToPlatform}
          className="flex items-center gap-2 px-4 py-3 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 transition-colors border-b border-zinc-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Platform</span>
        </button>
      )}
      
      {/* Logo */}
      <div className="p-6 border-b border-zinc-800">
        <Link href={userRole === 'super_admin' && !isImpersonating ? "/platform" : "/dashboard"} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center">
            <span className="text-black font-bold">
              {isImpersonating ? impersonatedOrgName.charAt(0).toUpperCase() : orgName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="font-bold text-white truncate max-w-[140px]">
              {isImpersonating ? impersonatedOrgName : (userRole === 'super_admin' ? 'CMPD' : orgName)}
            </h1>
            <p className="text-xs text-zinc-500">{getPortalLabel()}</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive
                  ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
              {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
            </Link>
          )
        })}
      </nav>

      {/* Upgrade Banner for Solo Trainers on Trial */}
      {isTrialing && isSoloTrainer && !isImpersonating && (
        <div className="p-4 border-t border-zinc-800">
          <Link
            href="/billing"
            className="block p-3 bg-gradient-to-r from-yellow-400/20 to-yellow-500/10 border border-yellow-400/30 rounded-xl hover:border-yellow-400/50 transition-all"
          >
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold text-yellow-400">Trial · {trialDaysLeft} days</span>
            </div>
            <p className="text-xs text-zinc-400">
              {hasPlanSelected ? (
                <><span className="text-green-400 capitalize">{selectedTier}</span> selected</>
              ) : (
                <>Pick a plan to continue</>
              )}
            </p>
          </Link>
        </div>
      )}

      {/* Theme Toggle & Sign Out */}
      <div className="p-4 border-t border-zinc-800 space-y-2">
        {mounted && (
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-5 h-5" />
                <span className="font-medium">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-5 h-5" />
                <span className="font-medium">Dark Mode</span>
              </>
            )}
          </button>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
