import crypto from 'crypto'

export const IMPERSONATION_COOKIE = 'impersonating_org'

function getSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('No SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY set')
  return secret
}

/** HMAC-sign the orgId. Cookie value format: `${orgId}.${hmacHex}` */
export function signImpersonationCookie(orgId: string): string {
  const hmac = crypto.createHmac('sha256', getSecret()).update(orgId).digest('hex')
  return `${orgId}.${hmac}`
}

/** Validate a signed impersonation cookie. Returns the orgId or null. */
export function verifyImpersonationCookie(raw: string | undefined | null): string | null {
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot < 1) return null
  const orgId = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  let expected: string
  try {
    expected = crypto.createHmac('sha256', getSecret()).update(orgId).digest('hex')
  } catch {
    return null
  }
  const a = Buffer.from(sig, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length) return null
  try {
    if (!crypto.timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  return orgId
}

/** HMAC-sign an arbitrary JSON-serializable payload (used for profile cache). */
export function signPayload(payload: string): string {
  const hmac = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
  return `${Buffer.from(payload).toString('base64url')}.${hmac}`
}

/** Verify a signed payload, returning the original string or null. */
export function verifyPayload(raw: string | undefined | null): string | null {
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot < 1) return null
  const payloadB64 = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  let payload: string
  try {
    payload = Buffer.from(payloadB64, 'base64url').toString('utf8')
  } catch {
    return null
  }
  let expected: string
  try {
    expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
  } catch {
    return null
  }
  const a = Buffer.from(sig, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length) return null
  try {
    if (!crypto.timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  return payload
}
