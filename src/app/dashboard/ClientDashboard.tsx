'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import BottomNav from '../components/BottomNav'
import ClientDashboardContent from './ClientDashboardContent'

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export default function ClientDashboard() {
  const router = useRouter()
  
  const { data, error, isLoading } = useSWR('/api/dashboard', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30000,
  })

  useEffect(() => {
    if (error?.message === 'Failed to fetch') {
      fetch('/api/dashboard').then(res => {
        if (res.status === 401) {
          router.push('/login')
        }
      })
    }
  }, [error, router])

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-black pb-32">
        <div className="px-6 pt-14 pb-6 animate-pulse">
          <div className="h-8 bg-zinc-800 rounded-lg w-48 mb-2"></div>
          <div className="h-5 bg-zinc-800/60 rounded w-64 mb-8"></div>
          
          <div className="bg-zinc-900 rounded-2xl p-6 mb-6">
            <div className="h-5 bg-zinc-800 rounded w-32 mb-4"></div>
            <div className="h-16 bg-zinc-800 rounded-xl mb-3"></div>
            <div className="h-12 bg-zinc-800 rounded-xl"></div>
          </div>
          
          <div className="bg-zinc-900 rounded-2xl p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <div className="h-5 bg-zinc-800 rounded w-24"></div>
              <div className="h-5 bg-zinc-800 rounded w-20"></div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-4 bg-zinc-800 rounded"></div>
              ))}
              {[...Array(35)].map((_, i) => (
                <div key={i} className="h-10 bg-zinc-800/50 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black pb-32">
      <ClientDashboardContent 
        firstName={data.firstName}
        workoutsByDay={data.workoutsByDay}
        programCount={data.programCount}
        completedWorkouts={data.completedWorkouts}
        scheduleByDay={data.scheduleByDay}
        calendarCompletions={data.calendarCompletions}
        programStartDate={data.programStartDate}
      />
      <BottomNav />
    </div>
  )
}
