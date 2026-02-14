/**
 * API fetch helper that includes credentials for Capacitor/WKWebView compatibility.
 * Use this instead of raw fetch() for all API calls.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include',  // Required for Capacitor/WKWebView to send auth cookies
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
