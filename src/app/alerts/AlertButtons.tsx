'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { X, Check, RefreshCw, Trash2 } from 'lucide-react'

export function DismissButton({ notificationId }: { notificationId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDismiss = async () => {
    setLoading(true)
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_dismissed: true }),
      })
      router.refresh()
    } catch (error) {
      console.error('Failed to dismiss notification:', error)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleDismiss}
      disabled={loading}
      className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
      title="Dismiss"
    >
      <X className="w-4 h-4" />
    </button>
  )
}

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleMarkRead = async () => {
    setLoading(true)
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      })
      router.refresh()
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleMarkRead}
      disabled={loading}
      className="p-2 text-zinc-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors disabled:opacity-50"
      title="Mark as read"
    >
      <Check className="w-4 h-4" />
    </button>
  )
}

export function RunCronButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleRunCron = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const response = await fetch('/api/cron/notifications', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer fitness-cron-secret-2026',
        },
      })
      const data = await response.json()
      setMessage(`Created ${data.results?.notificationsCreated || 0} new notifications`)
      router.refresh()
    } catch (error) {
      setMessage('Failed to run check')
      console.error('Failed to run cron:', error)
    }
    setLoading(false)
    setTimeout(() => setMessage(null), 3000)
  }

  return (
    <div className="relative">
      <button
        onClick={handleRunCron}
        disabled={loading}
        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Checking...' : 'Run Check Now'}
      </button>
      {message && (
        <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-zinc-800 text-sm text-zinc-300 rounded-lg whitespace-nowrap">
          {message}
        </div>
      )}
    </div>
  )
}

export function DismissAllButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDismissAll = async () => {
    if (!confirm('Dismiss all notifications? This cannot be undone.')) return
    
    setLoading(true)
    try {
      await fetch('/api/notifications/dismiss-all', {
        method: 'POST',
      })
      router.refresh()
    } catch (error) {
      console.error('Failed to dismiss all notifications:', error)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleDismissAll}
      disabled={loading}
      className="flex items-center gap-2 text-zinc-400 hover:text-red-400 px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
    >
      <Trash2 className="w-4 h-4" />
      {loading ? 'Dismissing...' : 'Dismiss All'}
    </button>
  )
}
