import { createClient } from '@/app/lib/supabase/client'

/**
 * API fetch helper that includes credentials AND auth header for Capacitor/WKWebView compatibility.
 * WKWebView often doesn't send cookies properly, so we also pass the auth token as a header.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers)
  
  try {
    // Get current session token from Supabase
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    // Add auth token as header (fallback for WKWebView cookie issues)
    if (session?.access_token) {
      headers.set('X-Supabase-Auth', session.access_token)
    }
  } catch (e) {
    console.error('[apiFetch] Failed to get session:', e)
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',  // Also try cookies
  })
}

/**
 * GET request helper
 */
export async function apiGet(url: string): Promise<Response> {
  return apiFetch(url, { method: 'GET' })
}

/**
 * POST request helper with JSON body
 */
export async function apiPost(url: string, body?: unknown): Promise<Response> {
  return apiFetch(url, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * DELETE request helper
 */
export async function apiDelete(url: string): Promise<Response> {
  return apiFetch(url, { method: 'DELETE' })
}

/**
 * PATCH request helper with JSON body
 */
export async function apiPatch(url: string, body?: unknown): Promise<Response> {
  return apiFetch(url, {
    method: 'PATCH',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}
