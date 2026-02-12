'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { CheckCircle, Sparkles } from 'lucide-react'

interface ChecklistItem {
  label: string
  href: string
  complete: boolean
}

interface OnboardingBannerProps {
  checklistItems: ChecklistItem[]
  trialDaysRemaining: number
  isWelcome?: boolean
  hasClient: boolean
  hasProgram: boolean
}

export default function OnboardingBanner({ 
  checklistItems, 
  trialDaysRemaining, 
  isWelcome,
  hasClient,
  hasProgram
}: OnboardingBannerProps) {
  const [visibleItems, setVisibleItems] = useState<boolean[]>(checklistItems.map(() => true))
  const [showComplete, setShowComplete] = useState(false)
  const hasAnimated = useRef(false)
  
  const allComplete = checklistItems.every(item => item.complete)
  const completedCount = checklistItems.filter(item => item.complete).length

  useEffect(() => {
    if (allComplete && !hasAnimated.current) {
      hasAnimated.current = true
      
      // Small delay before starting animation so user sees completed checklist
      const startDelay = setTimeout(() => {
        // Pop away items one by one
        checklistItems.forEach((_, index) => {
          setTimeout(() => {
            setVisibleItems(prev => {
              const newVisible = [...prev]
              newVisible[index] = false
              return newVisible
            })
          }, index * 350) // 350ms between each pop
        })

        // Show complete message after all items popped
        setTimeout(() => {
          setShowComplete(true)
        }, checklistItems.length * 350 + 200)
      }, 800) // 800ms initial delay so user sees the completed checklist first
      
      return () => clearTimeout(startDelay)
    }
  }, [allComplete, checklistItems])

  // Show completion state
  if (showComplete) {
    return (
      <div className="bg-gradient-to-r from-green-500/20 to-emerald-600/10 border border-green-500/30 rounded-xl p-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Onboarding Complete
              </h2>
              <p className="text-zinc-300">
                You&apos;re all set. <span className="text-blue-400 font-medium">{trialDaysRemaining} days</span> left in your trial.
              </p>
            </div>
          </div>
          <Link 
            href="/billing" 
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/20"
          >
            Upgrade Now
          </Link>
        </div>
      </div>
    )
  }

  // Show checklist
  return (
    <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6 text-black" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold text-white">
              {isWelcome ? 'Welcome to CMPD' : 'Getting Started'}
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-blue-400 font-medium">
                {trialDaysRemaining} days left
              </span>
              <span className="text-sm text-zinc-400">
                {completedCount}/{checklistItems.length} complete
              </span>
            </div>
          </div>
          <p className="text-zinc-300 mb-4">
            {isWelcome 
              ? <>Your account is ready. You have <span className="text-yellow-400 font-semibold">full access</span> to all features for 14 days — explore everything, then pick a plan that fits.</>
              : <>Complete these steps to get the most out of your trial. Full access to all features.</>
            }
          </p>
          
          {/* Getting Started Checklist */}
          <div className="bg-zinc-900/50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">Setup Checklist</h3>
            <div className="space-y-2">
              {checklistItems.map((item, index) => (
                <Link 
                  key={item.label}
                  href={item.href} 
                  className={`flex items-center gap-3 transition-all duration-300 group ${
                    item.complete ? 'text-green-400' : 'text-zinc-300 hover:text-white'
                  } ${!visibleItems[index] ? 'opacity-0 scale-75 h-0 overflow-hidden' : 'opacity-100 scale-100'}`}
                >
                  {item.complete ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <span className="w-5 h-5 rounded-full border-2 border-zinc-600 group-hover:border-yellow-500 flex items-center justify-center text-xs"></span>
                  )}
                  <span className={item.complete ? 'line-through opacity-60' : ''}>
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {!hasClient && (
              <Link href="/users/new" className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded-lg transition-colors">
                Add Client
              </Link>
            )}
            {!hasProgram && (
              <Link href="/programs/new" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors">
                Create Program
              </Link>
            )}
            <Link href="/billing" className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-medium rounded-lg transition-all shadow-lg shadow-blue-500/20">
              Upgrade Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
