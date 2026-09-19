import type { SupabaseClient } from '@supabase/supabase-js'

export type VerifiedUser = { id: string; email: string | null }

/**
 * Identify the signed-in caller without a network round trip.
 *
 * This project signs sessions with an asymmetric ES256 key, so getClaims()
 * verifies the access token's signature locally against the cached public key
 * (JWKS), refreshing the session first if it has expired. getUser() instead
 * calls the auth server every time — and middleware and the route handler were
 * each doing it, so every API request paid two auth round trips before it
 * touched any data.
 *
 * Same trust model as the database: PostgREST authorises every query by
 * verifying this same signature. The one behavioural difference is that a
 * revoked session stays valid until its token expires (at most an hour)
 * instead of immediately. getClaims() itself falls back to getUser() whenever
 * local verification isn't possible (symmetric key, no WebCrypto).
 *
 * Works with both the server and the browser client.
 */
export async function getVerifiedUser(supabase: SupabaseClient): Promise<VerifiedUser | null> {
  const { data, error } = await supabase.auth.getClaims()
  const sub = data?.claims?.sub
  if (error || !sub) return null
  const email = data?.claims?.email
  return { id: sub, email: typeof email === 'string' ? email : null }
}
