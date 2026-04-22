// HMAC signing + verification using Web Crypto (globalThis.crypto.subtle)
// so this works in BOTH Node runtime AND Edge runtime (Next.js middleware).
// Previous Node-only `import crypto from 'crypto'` version crashed middleware
// with MIDDLEWARE_INVOCATION_FAILED on Vercel.

export const IMPERSONATION_COOKIE = 'impersonating_org'

function getSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('No SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY set')
  return secret
}

const encoder = new TextEncoder()

async function hmacKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) return null
    out[i] = byte
  }
  return out
}

/** Constant-time byte comparison. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// base64url encode without padding (works in both Node Buffer and Edge btoa)
function base64UrlEncode(input: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'utf8').toString('base64url')
  }
  const b64 = btoa(unescape(encodeURIComponent(input)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(input: string): string | null {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(input, 'base64url').toString('utf8')
    }
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4)
    const bin = atob(b64)
    return decodeURIComponent(escape(bin))
  } catch {
    return null
  }
}

/** HMAC-sign the orgId. Cookie value format: `${orgId}.${hmacHex}` */
export async function signImpersonationCookie(orgId: string): Promise<string> {
  const key = await hmacKey()
  const sigBuf = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(orgId))
  return `${orgId}.${toHex(sigBuf)}`
}

/** Validate a signed impersonation cookie. Returns the orgId or null. */
export async function verifyImpersonationCookie(raw: string | undefined | null): Promise<string | null> {
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot < 1) return null
  const orgId = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  const sigBytes = hexToBytes(sig)
  if (!sigBytes) return null
  let expectedBuf: ArrayBuffer
  try {
    const key = await hmacKey()
    expectedBuf = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(orgId))
  } catch {
    return null
  }
  if (!timingSafeEqual(sigBytes, new Uint8Array(expectedBuf))) return null
  return orgId
}

/** HMAC-sign an arbitrary payload (used for middleware profile cache). */
export async function signPayload(payload: string): Promise<string> {
  const key = await hmacKey()
  const sigBuf = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return `${base64UrlEncode(payload)}.${toHex(sigBuf)}`
}

/** Verify a signed payload. Returns the original string or null. */
export async function verifyPayload(raw: string | undefined | null): Promise<string | null> {
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot < 1) return null
  const payloadB64 = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  const payload = base64UrlDecode(payloadB64)
  if (payload === null) return null
  const sigBytes = hexToBytes(sig)
  if (!sigBytes) return null
  let expectedBuf: ArrayBuffer
  try {
    const key = await hmacKey()
    expectedBuf = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  } catch {
    return null
  }
  if (!timingSafeEqual(sigBytes, new Uint8Array(expectedBuf))) return null
  return payload
}
