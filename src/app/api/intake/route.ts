import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendIntakeNotificationEmail } from '@/app/lib/email'
import type { IntakeAnswerPayload } from '@/app/lib/intake'

// Receives an injury intake form from the landing site and stores it.
//
// The landing site holds no database key. It posts here with a shared secret
// and this app, which already owns the service role key and the Resend setup,
// is the only thing that writes a row and sends the notification.
//
// This route is the reason the form can honestly tell someone it was received:
// if the insert fails this returns an error, and the landing page says so
// instead of showing a confirmation.

export const runtime = 'nodejs'

type Body = {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  areas?: string[]
  red_flags?: string[]
  answers?: IntakeAnswerPayload
}

/** Length-independent compare, so a wrong secret cannot be timed out character by character. */
function secretMatches(given: string | null, expected: string): boolean {
  if (!given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function POST(req: Request) {
  const expected = process.env.INTAKE_SECRET
  if (!expected) {
    console.error('[intake] INTAKE_SECRET is not set; refusing the submission')
    return NextResponse.json({ error: 'Intake is not configured' }, { status: 503 })
  }
  if (!secretMatches(req.headers.get('x-intake-secret'), expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const answers = body.answers
  if (!answers || !Array.isArray(answers.fields) || !answers.fields.length) {
    return NextResponse.json({ error: 'No answers' }, { status: 422 })
  }

  const row = {
    first_name: body.first_name?.trim() || null,
    last_name: body.last_name?.trim() || null,
    email: body.email?.trim() || null,
    phone: body.phone?.trim() || null,
    areas: Array.isArray(body.areas) ? body.areas : [],
    red_flags: Array.isArray(body.red_flags) ? body.red_flags : [],
    answers,
  }

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('intake_submissions')
    .insert(row)
    .select('id')
    .single()

  if (error || !data) {
    // Logged in full so a storage outage is still recoverable by hand, and
    // reported as a failure so the visitor is not told it went through.
    console.error('[intake] insert failed:', error?.message, JSON.stringify(row))
    return NextResponse.json({ error: 'Could not store the submission' }, { status: 502 })
  }

  // The row is saved, so a failed email is not a failed submission.
  try {
    await sendIntakeNotificationEmail({
      id: data.id,
      name: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'No name given',
      email: row.email,
      phone: row.phone,
      areas: row.areas,
      redFlags: row.red_flags,
      fields: answers.fields,
    })
  } catch (e) {
    console.error('[intake] stored, but the notification email failed:', e)
  }

  return NextResponse.json({ ok: true, id: data.id })
}
