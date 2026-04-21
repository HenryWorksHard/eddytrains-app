'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import LogClient from './LogClient'
import AppLoading from '@/components/AppLoading'

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export default function LogPage() {
  const router = useRouter()
  
  const { data, error, isLoading } = useSWR('/api/log', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 300000,
  })

  useEffect(() => {
    if (error) {
      fetch('/api/log').then(res => {
        if (res.status === 401) router.push('/login')
      })
    }
  }, [error, router])

  if (isLoading || !data) {
    return <AppLoading />
  }

  return <LogClient scheduleByDay={data.scheduleByDay} />
}
