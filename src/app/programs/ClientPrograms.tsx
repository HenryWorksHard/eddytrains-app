'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import BottomNav from '../components/BottomNav'
import PageHeader from '../components/PageHeader'
import ClientProgramsContent from './ClientProgramsContent'

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export default function ClientPrograms() {
  const router = useRouter()
  
  const { data, error, isLoading } = useSWR('/api/programs', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30000,
  })

  useEffect(() => {
    if (error) {
      fetch('/api/programs').then(res => {
        if (res.status === 401) router.push('/login')
      })
    }
  }, [error, router])

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-black pb-24">
        <PageHeader title="Programs" />
        <main className="px-6 py-6 animate-pulse">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-zinc-800 rounded-xl"></div>
              <div className="flex-1">
                <div className="h-6 bg-zinc-800 rounded w-48 mb-2"></div>
                <div className="h-4 bg-zinc-800/60 rounded w-full mb-2"></div>
                <div className="h-8 bg-zinc-800/40 rounded w-32"></div>
              </div>
            </div>
          </div>
          <div className="h-5 bg-zinc-800 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-5 bg-zinc-800 rounded w-32 mb-1"></div>
                    <div className="h-4 bg-zinc-800/60 rounded w-24"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (data.clientPrograms.length === 0) {
    return (
      <div className="min-h-screen bg-black pb-24">
        <PageHeader title="Programs" />
        <main className="px-6 py-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-zinc-600">?</span>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">No Active Program</h3>
            <p className="text-zinc-400">Your coach will assign your next program soon.</p>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black pb-24">
      <PageHeader title="Programs" />
      <main className="px-6 py-6">
        <ClientProgramsContent 
          clientPrograms={data.clientPrograms}
          programWorkoutsMap={data.programWorkoutsMap}
        />
      </main>
      <BottomNav />
    </div>
  )
}
