'use client'

import useSWR from 'swr'

export type MeResponse = {
  userId: string
  email: string
  role: string
  organizationId: string | null
  userOrganizationId: string | null
  companyId: string | null
  fullName: string | null
  orgName: string
  impersonating: { orgId: string; orgName: string } | null
}

const meFetcher = async (url: string): Promise<MeResponse | null> => {
  const res = await fetch(url)
  if (res.status === 401) return null
  if (!res.ok) throw new Error('Failed to load profile')
  return res.json()
}

/**
 * SWR-backed shared fetch of /api/me. Multiple components on the same
 * page share one network call and one cache entry.
 *
 * 5-minute deduping: role and org assignments rarely change inside a
 * session. Impersonation changes are picked up on navigation because
 * platform/page.tsx calls router.refresh() after toggling.
 */
export function useMe() {
  const { data, error, isLoading, mutate } = useSWR<MeResponse | null>('/api/me', meFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 300000,
    shouldRetryOnError: false,
  })

  return {
    me: data ?? null,
    loading: isLoading,
    error,
    refresh: mutate,
  }
}
