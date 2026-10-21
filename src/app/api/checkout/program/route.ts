import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * Starts a one-time Stripe Checkout for a catalog program.
 *
 * Called from the quiz result on cmpdcollective.com, so it is public and
 * takes nothing but a slug. Two things keep that safe:
 *
 *   - The slug has to match a program that exists and is program_kind
 *     'catalog'. A custom program written for one person cannot be bought by
 *     guessing its slug.
 *   - The amount never comes from the request. It is resolved from Stripe by
 *     lookup key, so the price is whatever Stripe says it is and a crafted
 *     request cannot buy a $180 program for $1.
 */

export const runtime = 'nodejs'

/** Stable per program, set by scripts/stripe-program-prices.mjs. */
export const priceLookupKey = (slug: string) => `cmpd_program_${slug}`

const SITE = process.env.LANDING_URL || 'https://cmpdcollective.com'

export async function POST(req: Request) {
  let body: { slug?: string; email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const slug = String(body.slug ?? '').trim()
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) {
    return NextResponse.json({ error: 'Unknown program' }, { status: 422 })
  }

  const admin = getSupabaseAdmin()
  const { data: program } = await admin
    .from('programs')
    .select('name, duration_weeks')
    .eq('slug', slug)
    .eq('program_kind', 'catalog')
    .maybeSingle()

  if (!program) {
    return NextResponse.json({ error: 'Unknown program' }, { status: 404 })
  }

  const stripe = getStripe()

  // By lookup key, so no price ids live in the code and changing a price is
  // a Stripe-side job with no deploy.
  const prices = await stripe.prices.list({
    lookup_keys: [priceLookupKey(slug)],
    active: true,
    limit: 1,
  })
  const price = prices.data[0]
  if (!price) {
    console.error(`[checkout] no active Stripe price with lookup key ${priceLookupKey(slug)}`)
    return NextResponse.json(
      { error: 'That program is not on sale yet.' },
      { status: 503 },
    )
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: price.id, quantity: 1 }],
      // Stripe collects it, and it becomes their login.
      customer_creation: 'always',
      billing_address_collection: 'auto',
      // The webhook reads this to know what was bought.
      metadata: { program_slug: slug },
      payment_intent_data: { metadata: { program_slug: slug } },
      ...(body.email ? { customer_email: String(body.email).trim() } : {}),
      success_url: `${SITE}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/quiz`,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Could not start checkout' }, { status: 502 })
    }
    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[checkout] stripe session failed:', e)
    return NextResponse.json({ error: 'Could not start checkout' }, { status: 502 })
  }
}
