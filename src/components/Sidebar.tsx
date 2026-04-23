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
  Mail,
  Menu,
  X,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import BrandMark from './BrandMark'

// Super Admin nav (Louis only - platform control)
const superAdminNavItems = [
  { name: 'Platform', href: '/platform', icon: Shield },
  { name: 'Companies', href: '/platform/companies', icon: Building2 },
  { name: 'Trainers', href: '/platform/trainers', icon: UserCheck },
  { name: 'Emails', href: '/platform/emails', icon: Mail },
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

const ROLE_CACHE_KEY = 'cmpd:sidebar-cache'

type CachedSidebarState = {
  role: string
  orgName: string
  isSoloTrainer: boolean
  isImpersonating: boolean
  impersonatedOrgName: string
}

function loadCachedState(): CachedSidebarState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(ROLE_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CachedSidebarState
  } catch {
    return null
  }
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // roleLoaded gates rendering of role-dependent UI so we don't flash the
  // default "trainer" view to a super admin before /api/me resolves.
  // On first render we hydrate from localStorage cache to kill the flash for
  // returning sessions; first-ever visit still waits for the API.
  const cached = loadCachedState()
  const [roleLoaded, setRoleLoaded] = useState(cached !== null)
  const [userRole, setUserRole] = useState<string>(cached?.role || 'trainer')
  const [isSoloTrainer, setIsSoloTrainer] = useState(cached?.isSoloTrainer ?? false)
  const [orgName, setOrgName] = useState<string>(cached?.orgName || 'CMPD')
  const [isImpersonating, setIsImpersonating] = useState(cached?.isImpersonating ?? false)
  const [impersonatedOrgName, setImpersonatedOrgName] = useState<string>(cached?.impersonatedOrgName || '')
  const [isTrialing, setIsTrialing] = useState(false)
  const [trialDaysLeft, setTrialDaysLeft] = useState(0)
  const [hasPlanSelected, setHasPlanSelected] = useState(false)
  const [selectedTier, setSelectedTier] = useState<string>('')

  useEffect(() => {
    setMounted(true)

    // Single source of truth: /api/me returns role, effective org, and impersonation state.
    async function loadMe() {
      try {
        const response = await fetch('/api/me')
        if (!response.ok) {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            router.push('/login')
            return
          }
          setUserRole('trainer')
          setRoleLoaded(true)
          return
        }

        const data = await response.json()
        const nextRole = data.role || 'trainer'
        const nextOrgName = data.orgName || 'CMPD'
        const nextSolo = data.role === 'trainer' ? !data.companyId : false
        const nextImpersonating = !!data.impersonating
        const nextImpersonatedOrgName = data.impersonating?.orgName || ''

        setUserRole(nextRole)
        setOrgName(nextOrgName)
        setIsSoloTrainer(nextSolo)
        setIsImpersonating(nextImpersonating)
        setImpersonatedOrgName(nextImpersonatedOrgName)
        setRoleLoaded(true)

        try {
          localStorage.setItem(
            ROLE_CACHE_KEY,
            JSON.stringify({
              role: nextRole,
              orgName: nextOrgName,
              isSoloTrainer: nextSolo,
              isImpersonating: nextImpersonating,
              impersonatedOrgName: nextImpersonatedOrgName,
            } satisfies CachedSidebarState)
          )
        } catch {
          // localStorage may be unavailable (private mode, quota); silently skip
        }
      } catch (error) {
        console.error('Error loading /api/me:', error)
        setRoleLoaded(true)
      }
    }
    loadMe()
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
    // Wait for the server to actually clear the cookie before navigating,
    // otherwise a stale cookie can still scope requests to the impersonated org.
    const res = await fetch('/api/impersonate', { method: 'DELETE' })
    if (!res.ok) {
      alert('Could not exit impersonation. Please try again.')
      return
    }
    setIsImpersonating(false)
    setImpersonatedOrgName('')
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
      
      {/* Logo — hidden until /api/me resolves to avoid flashing wrong brand/role */}
      <div className="p-6 border-b border-zinc-800">
        {roleLoaded ? (
          <Link href={userRole === 'super_admin' && !isImpersonating ? "/platform" : "/dashboard"} className="flex items-center gap-3">
            {userRole === 'super_admin' && !isImpersonating ? (
              <BrandMark size="md" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center">
                <span className="text-black font-bold">
                  {isImpersonating ? impersonatedOrgName.charAt(0).toUpperCase() : orgName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h1 className="font-bold text-white truncate max-w-[140px]">
                {isImpersonating ? impersonatedOrgName : (userRole === 'super_admin' ? 'CMPD' : orgName)}
              </h1>
              <p className="text-xs text-zinc-500">{getPortalLabel()}</p>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 animate-pulse" />
            <div className="space-y-2">
              <div className="w-24 h-3 bg-zinc-800 rounded animate-pulse" />
              <div className="w-16 h-2 bg-zinc-800 rounded animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {roleLoaded
          ? navItems.map((item) => {
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
            })
          : Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl">
                <div className="w-5 h-5 bg-zinc-800 rounded animate-pulse" />
                <div className="w-20 h-3 bg-zinc-800 rounded animate-pulse" />
              </div>
            ))}
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
        {roleLoaded ? (
          <Link href={userRole === 'super_admin' && !isImpersonating ? "/platform" : "/dashboard"} className="flex items-center gap-3">
            {userRole === 'super_admin' && !isImpersonating ? (
              <BrandMark size="sm" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center">
                <span className="text-black font-bold text-sm">
                  {isImpersonating ? impersonatedOrgName.charAt(0).toUpperCase() : orgName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="font-bold text-white">
              {isImpersonating ? impersonatedOrgName : (userRole === 'super_admin' ? 'CMPD' : orgName)}
            </span>
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-800 animate-pulse" />
            <div className="w-20 h-3 bg-zinc-800 rounded animate-pulse" />
          </div>
        )}
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
