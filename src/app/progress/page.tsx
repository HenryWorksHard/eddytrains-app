'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import BottomNav from '../components/BottomNav'
import PageHeader from '../components/PageHeader'
import ProgressClient from './ProgressClient'
import AppLoading from '@/components/AppLoading'

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export default function ProgressPage() {
  const router = useRouter()
  
  const tz = typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
  const { data, error, isLoading } = useSWR(`/api/progress?tz=${encodeURIComponent(tz)}`, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 300000,
  })

  useEffect(() => {
    if (error) {
      fetch('/api/progress').then(res => {
        if (res.status === 401) router.push('/login')
      })
    }
  }, [error, router])

  if (!data) {
    return <AppLoading />
  }

  return (
    <div className="min-h-screen bg-black pb-nav">
      <PageHeader title="Progress" />
      <ProgressClient
        oneRMs={data.oneRMs}
        estimated1RMs={data.estimated1RMs || []}
        progressImages={data.progressImages}
        weeklyTonnage={data.weeklyTonnage}
        tonnageTrendPct={data.tonnageTrendPct ?? null}
        monthCompletions={data.monthCompletions ?? 0}
        monthScheduled={data.monthScheduled ?? 0}
        streak={data.streak ?? 0}
        longestStreak={data.longestStreak ?? 0}
      />
      <BottomNav />
    </div>
  )
}
