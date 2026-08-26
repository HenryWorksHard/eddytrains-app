'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import LogClient from './LogClient'
import LogSkeleton from '@/components/skeletons/LogSkeleton'
import { formatDateToString } from '../lib/dateUtils'

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export default function LogPage() {
  const router = useRouter()

  // Audit fix (2026-08-23): pass the client's local "today" so /api/log
  // anchors the current-week computation to the user's timezone, not the
  // server's UTC. Without this, late-night/early-morning users at extreme
  // offsets could be served the wrong program week around midnight.
  const today = formatDateToString(new Date())
  const logUrl = `/api/log?today=${today}`

  const { data, error, isLoading } = useSWR(logUrl, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 300000,
  })

  useEffect(() => {
    if (error) {
      fetch(logUrl).then(res => {
        if (res.status === 401) router.push('/login')
      })
    }
  }, [error, router, logUrl])

  if (!data) {
    return <LogSkeleton />
  }

  return <LogClient scheduleByDay={data.scheduleByDay} />
}
