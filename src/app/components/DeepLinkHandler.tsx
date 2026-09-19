'use client'

import { useEffect } from 'react'

/**
 * Handles Universal Link (deep-link) opens inside the Capacitor iOS wrap.
 *
 * When a user taps a link to https://app.cmpdcollective.com/... from an
 * email (password reset, invite acceptance), iOS opens the Capacitor app
 * directly IF the associated-domains entitlement + AASA file are set up.
 * The app receives the full URL via `App.addListener('appUrlOpen')` — but
 * WKWebView doesn't automatically navigate to it. Without this handler,
 * the app would launch on its previous URL (usually /dashboard) and
 * silently drop the incoming reset link + tokens.
 *
 * Why window.location.href, not router.push:
 *   - The recovery URL carries session tokens in the hash fragment
 *     (`#access_token=...&refresh_token=...`). Next.js's App Router
 *     strips hash fragments on router.push in some versions, which
 *     would defeat the whole point of the deep link.
 *   - window.location.href preserves the full URL including the hash so
 *     /update-password's session-restore logic sees the tokens intact.
 *
 * Web-build no-op:
 *   Capacitor plugins throw if called in a plain browser. We swallow the
 *   dynamic-import error so this component is safe to mount everywhere.
 */
export default function DeepLinkHandler() {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    async function setup() {
      try {
        const { App } = await import('@capacitor/app')
        const listener = await App.addListener('appUrlOpen', (event) => {
          try {
            const incoming = new URL(event.url)
            const target = incoming.pathname + incoming.search + incoming.hash
            const current = window.location.pathname + window.location.search + window.location.hash
            if (target && target !== current) {
              // Full navigation (not client-side) to guarantee hash tokens
              // land in Supabase's URL-detection code.
              window.location.href = target
            }
          } catch (e) {
            console.error('[DeepLinkHandler] Failed to parse deep-link URL:', event.url, e)
          }
        })
        unsubscribe = () => {
          listener.remove().catch(() => {})
        }
      } catch {
        // Not running inside Capacitor (regular browser) — nothing to do.
      }
    }

    setup()
    return () => {
      unsubscribe?.()
    }
  }, [])

  return null
}
