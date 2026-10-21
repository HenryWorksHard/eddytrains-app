#!/usr/bin/env node
/**
 * Creates (or updates) the Stripe Product and one-time Price for every
 * injury program, and tags each Price with a stable lookup key.
 *
 * The lookup key is the point of this. The app never stores a price id: it
 * asks Stripe for the active price with key `cmpd_program_<slug>`. So a price
 * change is a Stripe-side job with no code change and no deploy, and there is
 * no list of ids to keep in sync with anything.
 *
 * Prices are $15 AUD per week of programming.
 *
 *   Test run:   node scripts/stripe-program-prices.mjs --key sk_test_...
 *   Dry run:    node scripts/stripe-program-prices.mjs --dry
 *   For real:   node scripts/stripe-program-prices.mjs --live
 *
 * Re-running is safe. A program whose price already matches is left alone; a
 * changed price creates a new Price and moves the lookup key onto it, which
 * is how Stripe expects prices to be versioned (they are immutable).
 */

import Stripe from 'stripe'
import fs from 'node:fs'

const RATE_PER_WEEK = 15 // AUD
const CURRENCY = 'aud'

const PROGRAMS = [
  { slug: 'shoulder',   name: 'Shoulder Strength',          weeks: 8 },
  { slug: 'lower-back', name: 'Lower Back Strength',        weeks: 8 },
  { slug: 'knee',       name: 'Knee Strength',              weeks: 10 },
  { slug: 'hip',        name: 'Hip & Glute Strength',       weeks: 8 },
  { slug: 'neck',       name: 'Neck & Upper Back Strength', weeks: 6 },
  { slug: 'return',     name: 'Return to Training',         weeks: 12 },
]

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const valueOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null }

const dry = has('--dry')

function readKey() {
  const explicit = valueOf('--key')
  if (explicit) return explicit
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY
  try {
    const env = fs.readFileSync('.env.local', 'utf8')
    const m = env.match(/^STRIPE_SECRET_KEY=(.+)$/m)
    if (m) return m[1].trim()
  } catch { /* no env file */ }
  return null
}

const key = readKey()
if (!key) {
  console.error('No Stripe key. Pass --key sk_test_... or set STRIPE_SECRET_KEY.')
  process.exit(1)
}

const live = key.startsWith('sk_live')
if (live && !has('--live') && !dry) {
  console.error(
    'That is a LIVE Stripe key and this would create real products.\n' +
    'Run it against a test key first:\n' +
    '  node scripts/stripe-program-prices.mjs --key sk_test_...\n' +
    'When you are happy, re-run with --live to mean it.',
  )
  process.exit(1)
}

const stripe = new Stripe(key)
const lookupKey = (slug) => `cmpd_program_${slug}`

console.log(`${dry ? 'DRY RUN' : live ? 'LIVE MODE' : 'TEST MODE'} — $${RATE_PER_WEEK} ${CURRENCY.toUpperCase()} per week\n`)
console.log('program                 weeks   price   per session   action')
console.log('-'.repeat(68))

for (const p of PROGRAMS) {
  const dollars = p.weeks * RATE_PER_WEEK
  const cents = dollars * 100
  const perSession = (dollars / (p.weeks * 4)).toFixed(2)
  const lk = lookupKey(p.slug)

  let action = ''
  try {
    const existing = await stripe.prices.list({ lookup_keys: [lk], active: true, limit: 1 })
    const current = existing.data[0]

    if (current && current.unit_amount === cents && current.currency === CURRENCY) {
      action = 'already correct'
    } else if (dry) {
      action = current ? `would reprice from $${(current.unit_amount / 100).toFixed(2)}` : 'would create'
    } else {
      // Reuse the product if there is one, so the purchase history stays together.
      let productId = current?.product
      if (!productId) {
        const product = await stripe.products.create({
          name: `${p.name} (${p.weeks}-week program)`,
          description: `${p.weeks} weeks, ${p.weeks * 4} sessions. One-time purchase, no subscription.`,
          metadata: { program_slug: p.slug, weeks: String(p.weeks) },
        })
        productId = product.id
      }

      // Prices are immutable in Stripe, so a change means a new price that
      // takes the lookup key with it. The old one stays for past receipts.
      await stripe.prices.create({
        product: productId,
        currency: CURRENCY,
        unit_amount: cents,
        lookup_key: lk,
        transfer_lookup_key: true,
        metadata: { program_slug: p.slug, weeks: String(p.weeks), per_session: perSession },
      })
      action = current ? `repriced from $${(current.unit_amount / 100).toFixed(2)}` : 'created'
    }
  } catch (e) {
    action = `FAILED: ${e.message}`
  }

  console.log(
    `${p.name.padEnd(24)}${String(p.weeks).padStart(4)}   ` +
    `$${String(dollars).padEnd(6)}$${perSession.padEnd(13)}${action}`,
  )
}

console.log('\nThe app resolves these by lookup key, so there is nothing to copy anywhere.')
if (dry) console.log('Nothing was changed. Drop --dry to apply.')
