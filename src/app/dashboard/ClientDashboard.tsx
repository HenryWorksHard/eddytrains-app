'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import BottomNav from '../components/BottomNav'
import ClientDashboardContent from './ClientDashboardContent'
import { formatDateToString } from '../lib/dateUtils'
import AppLoading from '@/components/AppLoading'

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export default function ClientDashboard() {
  const router = useRouter()

  // Pass the client's local "today" so the server anchors the calendar
  // window and "today's completions" to the user's timezone, not Vercel's.
  const today = formatDateToString(new Date())
  const dashboardUrl = `/api/dashboard?today=${today}`

  // Silently persist the client's IANA timezone so trainer-side APIs
  // can use it when displaying this client's data. Only fires once per
  // session per unique timezone — saves a round-trip on every dashboard visit.
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!tz) return
    try {
      const cached = localStorage.getItem('cmpd:tz')
      if (cached === tz) return
      localStorage.setItem('cmpd:tz', tz)
    } catch {
      // localStorage unavailable; still send it
    }
    fetch('/api/me/timezone', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: tz }),
    }).catch(() => {})
  }, [])

  const { data, error, isLoading } = useSWR(dashboardUrl, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 300000,
  })

  useEffect(() => {
    if (error?.message === 'Failed to fetch') {
      fetch(dashboardUrl).then(res => {
        if (res.status === 401) {
          router.push('/login')
        }
      })
    }
  }, [error, router, dashboardUrl])

  if (!data) {
    return (
      <AppLoading message="Loading your dashboard..." />
    )
  }

  return (
    <div className="min-h-screen bg-black pb-nav">
      <ClientDashboardContent
        firstName={data.firstName}
        workoutsByDay={data.workoutsByDay}
        programCount={data.programCount}
        completedWorkouts={data.completedWorkouts}
        scheduleByDay={data.scheduleByDay}
        scheduleByWeekAndDay={data.scheduleByWeekAndDay}
        calendarCompletions={data.calendarCompletions}
        completionsByDate={data.completionsByDate}
        programStartDate={data.programStartDate}
        maxWeek={data.maxWeek}
        streak={data.streak ?? 0}
        longestStreak={data.longestStreak ?? 0}
        lastProgressPhotoDate={data.lastProgressPhotoDate ?? null}
      />
      <BottomNav />
    </div>
  )
}
