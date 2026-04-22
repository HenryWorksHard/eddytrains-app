'use client'

import { useIsNativeApp } from '@/hooks/useIsNativeApp'

/**
 * Hides its children when the app is running inside Capacitor (iOS/Android native).
 * Used to gate payment/billing/upgrade UI that violates App Store rules.
 */
export default function NativeAppHidden({ children }: { children: React.ReactNode }) {
  const isNativeApp = useIsNativeApp()
  if (isNativeApp) return null
  return <>{children}</>
}
