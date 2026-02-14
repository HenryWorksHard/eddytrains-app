'use client';

import { useState, useEffect } from 'react';

/**
 * Detect if running inside Capacitor native app (iOS/Android)
 * Used to hide payment UI that would violate App Store rules
 */
export function useIsNativeApp(): boolean {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    // Check for Capacitor
    const hasCapacitor = typeof window !== 'undefined' && 
      (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor !== undefined;
    
    // Double-check with isNativePlatform if available
    if (hasCapacitor) {
      const Capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
      setIsNative(Capacitor?.isNativePlatform?.() ?? true);
    }
  }, []);

  return isNative;
}

/**
 * Sync version for conditional rendering in server components
 * Note: Always returns false on server, true detection only on client
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const Capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Capacitor?.isNativePlatform?.() ?? (Capacitor !== undefined);
}
