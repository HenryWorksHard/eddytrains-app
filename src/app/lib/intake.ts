// Injury intake submissions from the landing page.
//
// The questions themselves live in cmpd-landing/app/intake-form.ts and arrive
// here as a flat answers object. This app deliberately does not keep a second
// copy of them: it renders whatever labels came with the submission, so a
// question added on the landing site shows up here without a deploy.

export type IntakeStatus = 'new' | 'contacted' | 'booked' | 'closed' | 'spam'

export const INTAKE_STATUSES: { value: IntakeStatus; label: string; hint: string }[] = [
  { value: 'new', label: 'New', hint: 'Not looked at yet' },
  { value: 'contacted', label: 'Contacted', hint: 'Reached out, waiting on them' },
  { value: 'booked', label: 'Booked', hint: 'Call is in the diary' },
  { value: 'closed', label: 'Closed', hint: 'Dealt with, program sent or not proceeding' },
  { value: 'spam', label: 'Spam', hint: 'Junk' },
]

export function isIntakeStatus(v: unknown): v is IntakeStatus {
  return typeof v === 'string' && INTAKE_STATUSES.some((s) => s.value === v)
}

/** One question and its answer, in the order the form asked them. */
export type IntakeAnswer = { name: string; label: string; value: string }

export type IntakeSubmission = {
  id: string
  created_at: string
  status: IntakeStatus
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  areas: string[]
  red_flags: string[]
  answers: IntakeAnswerPayload
  notes: string | null
  handled_by: string | null
  handled_at: string | null
}

/**
 * What the landing site posts. `fields` carries the label with the value so
 * this app can render the form without knowing the questions; `values` is the
 * raw keyed object, kept so nothing is lost if the labels ever change.
 */
export type IntakeAnswerPayload = {
  fields: IntakeAnswer[]
  values: Record<string, string | string[]>
}

export function fullName(s: Pick<IntakeSubmission, 'first_name' | 'last_name'>): string {
  const n = [s.first_name, s.last_name].filter(Boolean).join(' ').trim()
  return n || 'No name given'
}

/** Sections are implied by blank-label separators; nothing fancier is needed. */
export function answerList(payload: IntakeAnswerPayload | null | undefined): IntakeAnswer[] {
  if (!payload || !Array.isArray(payload.fields)) return []
  return payload.fields.filter((f) => f && typeof f.label === 'string')
}
