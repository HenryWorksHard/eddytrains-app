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
  Menu,
  X,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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
      fetch(`/api/organizations/${impersonatingOrgId}`)
        .then(res => res.json())
        .then(data => {
          if (data?.name) {
            setImpersonatedOrgName(data.name)
          }
        })
        .catch(() => {})
    }
    
    async function checkRole() {
      try {
        // Use /api/me endpoint which bypasses RLS
        const response = await fetch('/api/me')
        if (!response.ok) {
          console.log('Failed to get user info, signing out...')
          await supabase.auth.signOut()
          router.push('/login')
          return
        }
        
        const data = await response.json()
        console.log('[Sidebar] User info:', data)
        
        setUserRole(data.role || 'trainer')
        setOrgName(data.orgName || 'CMPD')
        
        // Check if trainer is solo (no company_id) or under a company
        if (data.role === 'trainer') {
          setIsSoloTrainer(!data.companyId)
        }
        
        // TODO: Add trial/subscription info to /api/me response if needed
      } catch (error) {
        console.error('Error checking role:', error)
      }
    }
    checkRole()
  }, [supabase, router])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])
  
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

  // Sidebar content (shared between desktop and mobile)
  const SidebarContent = () => (
    <>
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
    </>
  )

  return (
    <>
      {/* Mobile Header with Hamburger */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 z-50">
        <Link href={userRole === 'super_admin' && !isImpersonating ? "/platform" : "/dashboard"} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center">
            <span className="text-black font-bold text-sm">
              {isImpersonating ? impersonatedOrgName.charAt(0).toUpperCase() : orgName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="font-bold text-white">
            {isImpersonating ? impersonatedOrgName : (userRole === 'super_admin' ? 'CMPD' : orgName)}
          </span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-zinc-400 hover:text-white transition-colors"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Slide-out Menu */}
      <aside className={`lg:hidden fixed top-0 left-0 h-screen w-72 bg-zinc-900 border-r border-zinc-800 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Close button inside menu */}
        <div className="flex justify-end p-4">
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 bg-zinc-900 border-r border-zinc-800 flex-col z-40">
        <SidebarContent />
      </aside>

      {/* Spacer for mobile header */}
      <div className="lg:hidden h-16" />
    </>
  )
}
