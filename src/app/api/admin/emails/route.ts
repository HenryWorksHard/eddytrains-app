import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, unauthorized, forbidden } from '@/app/lib/auth-guard'

// Proxies Resend's list-emails endpoint for the super-admin Email notifications
// page. The Resend list endpoint is not available on every plan — if it errors,
// we return an empty list with a friendly error message rather than a 500.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return unauthorized()
  if (ctx.role !== 'super_admin') return forbidden()

  const key = process.env.RESEND_API_KEY
  if (!key) {
    return NextResponse.json({ data: [], error: 'RESEND_API_KEY not configured' })
  }

  const url = new URL(request.url)
  const limitParam = parseInt(url.searchParams.get('limit') || '50', 10)
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 50, 1), 100)

  try {
    const res = await fetch(`https://api.resend.com/emails?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      let msg = `Resend API returned ${res.status}`
      try {
        const body = await res.json()
        if (body?.message) msg = body.message
      } catch { /* ignore */ }
      return NextResponse.json({ data: [], error: msg })
    }

    const body = await res.json()
    return NextResponse.json({ data: body?.data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ data: [], error: msg })
  }
}
