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
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center mb-6">
          <span className="text-black text-2xl font-bold">C</span>
        </div>
        {/* Spinner */}
        <div className="w-8 h-8 border-3 border-zinc-700 border-t-yellow-400 rounded-full animate-spin"></div>
        <p className="text-zinc-500 text-sm mt-4">Loading your dashboard...</p>
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
        scheduleByWeekAndDay={data.scheduleByWeekAndDay}
        calendarCompletions={data.calendarCompletions}
        programStartDate={data.programStartDate}
        maxWeek={data.maxWeek}
      />
      <BottomNav />
    </div>
  )
}
