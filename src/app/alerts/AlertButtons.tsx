'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { X, Check, Trash2 } from 'lucide-react'

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

// Audit fix (2026-08-23): RunCronButton removed. It shipped with a
// hardcoded bearer token in the client bundle ('fitness-cron-secret-2026')
// AND the endpoint it hit (/api/cron/notifications) does not exist, so it
// was doubly broken: dead + leaking a secret. If we ever want a manual
// "run notifications check" trigger, do it as a server action gated by
// super_admin, not a browser-side fetch with a static header.

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
