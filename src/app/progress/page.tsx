'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import BottomNav from '../components/BottomNav'
import PageHeader from '../components/PageHeader'
import ProgressClient from './ProgressClient'

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export default function ProgressPage() {
  const router = useRouter()
  
  const { data, error, isLoading } = useSWR('/api/progress', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30000,
  })

  useEffect(() => {
    if (error) {
      fetch('/api/progress').then(res => {
        if (res.status === 401) router.push('/login')
      })
    }
  }, [error, router])

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-black pb-24">
        <PageHeader title="Progress" />
        <main className="px-6 py-6 space-y-6 animate-pulse">
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="h-4 bg-zinc-800 rounded w-20 mb-2"></div>
                <div className="h-8 bg-zinc-800 rounded w-16"></div>
              </div>
            ))}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <div className="h-5 bg-zinc-800 rounded w-40 mb-4"></div>
            <div className="h-48 bg-zinc-800/50 rounded-xl"></div>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black pb-24">
      <PageHeader title="Progress" />
      <ProgressClient 
        oneRMs={data.oneRMs}
        progressImages={data.progressImages}
        weeklyTonnage={data.weeklyTonnage}
      />
      <BottomNav />
    </div>
  )
}
