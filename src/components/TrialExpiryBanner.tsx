'use client'

import Link from 'next/link'
import { AlertTriangle, Clock, Zap, XCircle } from 'lucide-react'

interface TrialExpiryBannerProps {
  daysRemaining: number
}

export default function TrialExpiryBanner({ daysRemaining }: TrialExpiryBannerProps) {
  // Determine urgency level and styling
  const isExpired = daysRemaining <= 0
  const isUrgent = daysRemaining === 1
  const isWarning = daysRemaining <= 3 && daysRemaining > 1

  let bgColor: string
  let textColor: string
  let buttonColor: string
  let Icon: typeof AlertTriangle
  let message: string
  let subtitle: string

  if (isExpired) {
    bgColor = 'bg-red-500/20 border-red-500/50'
    textColor = 'text-red-400'
    buttonColor = 'bg-red-500 hover:bg-red-400'
    Icon = XCircle
    message = 'Your trial has expired'
    subtitle = 'Subscribe now to restore access to all your programs and client data.'
  } else if (daysRemaining === 1) {
    bgColor = 'bg-red-500/20 border-red-500/50'
    textColor = 'text-red-400'
    buttonColor = 'bg-red-500 hover:bg-red-400'
    Icon = AlertTriangle
    message = 'Your trial expires tomorrow!'
    subtitle = 'Subscribe now to keep access to all your programs and client data.'
  } else {
    bgColor = 'bg-orange-500/20 border-orange-500/50'
    textColor = 'text-orange-400'
    buttonColor = 'bg-orange-500 hover:bg-orange-400'
    Icon = Clock
    message = `Your trial expires in ${daysRemaining} days`
    subtitle = 'Subscribe now to keep access to all your programs and client data.'
  }

  return (
    <div className={`${bgColor} border rounded-xl p-4 flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${isExpired || isUrgent ? 'bg-red-500/30' : 'bg-orange-500/30'} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${textColor}`} />
        </div>
        <div>
          <p className={`font-semibold ${textColor}`}>
            {message}
          </p>
          <p className="text-zinc-400 text-sm">
            {subtitle}
          </p>
        </div>
      </div>
      <Link 
        href="/billing" 
        className={`${buttonColor} text-white px-6 py-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2 whitespace-nowrap`}
      >
        <Zap className="w-4 h-4" />
        {isExpired ? 'Subscribe Now' : 'Upgrade Now'}
      </Link>
    </div>
  )
}
