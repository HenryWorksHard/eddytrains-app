'use client'

import { LayoutDashboard, Dumbbell, TrendingUp, Apple, Calendar, User } from 'lucide-react'

export type TabType = 'overview' | 'programs' | 'progress' | 'profile' | 'nutrition' | 'schedule'

interface ClientTabsProps {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
}

const tabs = [
  { id: 'profile' as TabType, label: 'Profile', icon: User },
  { id: 'overview' as TabType, label: 'Overview', icon: LayoutDashboard },
  { id: 'programs' as TabType, label: 'Programs', icon: Dumbbell },
  { id: 'progress' as TabType, label: 'Progress', icon: TrendingUp },
  { id: 'nutrition' as TabType, label: 'Nutrition', icon: Apple },
  { id: 'schedule' as TabType, label: 'Schedule', icon: Calendar },
]

export default function ClientTabs({ activeTab, setActiveTab }: ClientTabsProps) {
  return (
    <div className="mb-6 max-w-full overflow-hidden">
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800 inline-flex min-w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? 'bg-yellow-400 text-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
