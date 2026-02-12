'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import LogClient from './LogClient'

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export default function LogPage() {
  const router = useRouter()
  
  const { data, error, isLoading } = useSWR('/api/log', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30000,
  })

  useEffect(() => {
    if (error) {
      fetch('/api/log').then(res => {
        if (res.status === 401) router.push('/login')
      })
    }
  }, [error, router])

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-black">
        <header className="sticky top-0 bg-black/95 backdrop-blur-lg border-b border-zinc-800 z-40 animate-pulse">
          <div className="flex items-center px-4 pt-3 pb-1">
            <div className="h-6 bg-zinc-800 rounded w-16"></div>
          </div>
          <div className="flex items-center justify-between px-4 py-2">
            <div className="w-10 h-10 bg-zinc-800 rounded"></div>
            <div className="flex flex-col items-center">
              <div className="h-6 bg-zinc-800 rounded w-24 mb-1"></div>
              <div className="h-4 bg-zinc-800/60 rounded w-16"></div>
            </div>
            <div className="w-10 h-10 bg-zinc-800 rounded"></div>
          </div>
        </header>
        <main className="px-4 py-4 pb-24 animate-pulse">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-zinc-700 rounded-full"></div>
                <div>
                  <div className="h-5 bg-zinc-800 rounded w-32 mb-1"></div>
                  <div className="h-4 bg-zinc-800/60 rounded w-24"></div>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-zinc-800/50 rounded-xl p-3">
                  <div className="h-5 bg-zinc-700 rounded w-40 mb-2"></div>
                  <div className="flex gap-2">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="h-10 bg-zinc-700/50 rounded w-16"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  return <LogClient scheduleByDay={data.scheduleByDay} />
}
