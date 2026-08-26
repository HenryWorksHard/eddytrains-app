// Lightweight in-memory rate limiter. Not distributed (each Vercel
// serverless instance has its own state) but a huge improvement over
// zero throttling. Sufficient until we wire up Upstash / Vercel KV for
// per-project shared state.
//
// Audit fix (2026-08-23): /api/auth/send-password-reset and /api/signup
// were public endpoints with no throttling — attacker could flood any
// user's inbox with Resend recovery mails, or create thousands of orphan
// orgs + Stripe customers by scripted signups.
//
// Usage:
//   const gate = rateLimit(request, {
//     key: `signup:${ip}`,
//     limit: 5,
//     windowMs: 60 * 60 * 1000, // 1 hour
//   })
//   if (!gate.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

const buckets = new Map<string, number[]>()

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number // epoch ms when the oldest entry expires
}

export function rateLimit(opts: {
  key: string
  limit: number
  windowMs: number
}): RateLimitResult {
  const { key, limit, windowMs } = opts
  const now = Date.now()
  const cutoff = now - windowMs

  // Pull existing timestamps and drop anything outside the window.
  const existing = buckets.get(key) || []
  const alive = existing.filter((t) => t > cutoff)

  if (alive.length >= limit) {
    // Over quota. Compute resetAt from the oldest surviving entry.
    return {
      allowed: false,
      remaining: 0,
      resetAt: alive[0] + windowMs,
    }
  }

  // Within quota — record this hit.
  alive.push(now)
  buckets.set(key, alive)

  // Best-effort cleanup so the Map doesn't grow unboundedly. Trigger
  // occasionally to avoid scanning on every call.
  // Audit fix (2026-08-26): only DELETE keys whose newest entry is older
  // than the longest window any caller uses (1h). Do NOT prune individual
  // timestamps with the current caller's `cutoff` — a cleanup fired from a
  // 5-min gate used to strip still-valid entries from 1-hour buckets,
  // silently resetting hourly limits early.
  if (buckets.size > 500 && Math.random() < 0.01) {
    const MAX_WINDOW_MS = 60 * 60 * 1000
    const staleBefore = now - MAX_WINDOW_MS
    for (const [k, entries] of buckets.entries()) {
      const newest = entries.length > 0 ? entries[entries.length - 1] : 0
      if (newest <= staleBefore) buckets.delete(k)
    }
  }

  return {
    allowed: true,
    remaining: limit - alive.length,
    resetAt: alive[0] + windowMs,
  }
}

// Extract a client IP from Next.js request headers. Vercel populates
// x-forwarded-for; local dev falls back to a fixed sentinel so per-IP
// limits are still enforceable in a manual test.
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return '127.0.0.1'
}
