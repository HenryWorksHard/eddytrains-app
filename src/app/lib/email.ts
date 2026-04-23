import { Resend } from 'resend'

// Transactional email via Resend.
// Replaces the previous Klaviyo integration (removed 2026-04-20).

/**
 * Per-template enable/disable check. Driven by the email_template_settings
 * table (managed via /platform/emails). Defaults to TRUE on any error so a
 * config glitch never silently kills all transactional email.
 */
async function isEmailEnabled(name: string): Promise<boolean> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(url, key, { auth: { persistSession: false } })
    const { data } = await admin
      .from('email_template_settings')
      .select('enabled')
      .eq('name', name)
      .maybeSingle()
    return data?.enabled !== false
  } catch (e) {
    console.error('[email] isEmailEnabled check failed, defaulting to true:', e)
    return true
  }
}

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error('RESEND_API_KEY not set')
  }
  return new Resend(key)
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.cmpdcollective.com'
}

function getFromInvite() {
  return process.env.RESEND_FROM_INVITE || 'eddy@cmpdcollective.com'
}

/**
 * Reply-to address for all transactional email. Reads from the
 * email_config table (managed via /platform/emails) so a super-admin can
 * change it without a deploy. On any DB error we fall back to the
 * RESEND_REPLY_TO env var, then to the hardcoded support inbox — that
 * way a config glitch never breaks the send pipeline.
 */
async function getReplyTo(): Promise<string> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(url, key, { auth: { persistSession: false } })
    const { data } = await admin
      .from('email_config')
      .select('reply_to')
      .eq('id', 1)
      .maybeSingle()
    if (data?.reply_to) return data.reply_to
  } catch (e) {
    console.error('[email] getReplyTo DB read failed, falling back:', e)
  }
  return process.env.RESEND_REPLY_TO || 'cmpdcollective@gmail.com'
}

type SendInviteArgs = {
  email: string
  fullName?: string | null
  token: string
  trainerName?: string | null
  orgName?: string | null
}

export async function sendInviteEmail({
  email,
  fullName,
  token,
  trainerName,
  orgName,
}: SendInviteArgs): Promise<{ id: string | null | undefined; skipped?: boolean }> {
  if (!(await isEmailEnabled('invite'))) {
    return { id: null, skipped: true }
  }
  const resend = getResend()
  const link = `${getAppUrl()}/accept-invite?token=${token}`
  const logoUrl = `${getAppUrl()}/logo.svg`
  const greeting = fullName ? `Hi ${fullName.split(' ')[0]},` : 'Hi,'
  const fromLine = trainerName
    ? `${trainerName} has set up your CMPD Fitness account.`
    : orgName
    ? `${orgName} has set up your CMPD Fitness account.`
    : 'Your CMPD Fitness account is ready.'

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0; padding:0; background:#0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a; padding:48px 24px;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px; background:#18181b; border-radius:16px; padding:40px;">
                <tr>
                  <td style="padding-bottom:24px;">
                    <div style="width:56px; height:56px; border-radius:14px; background:#000; display:inline-block; overflow:hidden; text-align:center;">
                      <img src="${logoUrl}" alt="CMPD" width="56" height="56" style="display:block; width:56px; height:56px; border-radius:14px;" />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="color:#fff; font-size:24px; font-weight:700; padding-bottom:16px;">
                    You're in.
                  </td>
                </tr>
                <tr>
                  <td style="color:#d4d4d8; font-size:16px; line-height:1.6; padding-bottom:24px;">
                    ${greeting}<br><br>
                    ${fromLine} Click the button below to set your password and start training.
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:24px;">
                    <a href="${link}" style="display:inline-block; background:#facc15; color:#000; padding:14px 28px; border-radius:12px; font-weight:700; text-decoration:none; font-size:16px;">
                      Set your password
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="color:#71717a; font-size:13px; line-height:1.5; padding-bottom:16px;">
                    Or copy this link into your browser:<br>
                    <span style="color:#a1a1aa; word-break:break-all;">${link}</span>
                  </td>
                </tr>
                <tr>
                  <td style="color:#52525b; font-size:12px; line-height:1.5; border-top:1px solid #27272a; padding-top:16px;">
                    This link expires in 7 days. If you didn't expect this invite, you can ignore it.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `

  const subject = trainerName
    ? `${trainerName} invited you to CMPD Fitness`
    : 'Your CMPD Fitness account is ready'

  const result = await resend.emails.send({
    from: getFromInvite(),
    to: email,
    replyTo: await getReplyTo(),
    subject,
    html,
    tags: [{ name: 'template', value: 'invite' }],
  })

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`)
  }

  return { id: result.data?.id }
}

/**
 * Sent to a client when their trainer toggles access-paused OFF.
 * Welcomes them back so they know they can re-open the app immediately.
 */
export async function sendAccessRestoredEmail({
  email,
  fullName,
  trainerName,
}: {
  email: string
  fullName?: string | null
  trainerName?: string | null
}): Promise<{ id: string | null | undefined; skipped?: boolean }> {
  if (!(await isEmailEnabled('access_restored'))) {
    return { id: null, skipped: true }
  }
  const resend = getResend()
  const logoUrl = `${getAppUrl()}/logo.svg`
  const appUrl = getAppUrl()
  const greeting = fullName ? `Hi ${fullName.split(' ')[0]},` : 'Hi,'
  const fromLine = trainerName
    ? `Your trainer ${trainerName} has restored your CMPD Fitness app access.`
    : 'Your CMPD Fitness app access has been restored.'

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0; padding:0; background:#0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a; padding:48px 24px;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px; background:#18181b; border-radius:16px; padding:40px;">
                <tr>
                  <td style="padding-bottom:24px;">
                    <div style="width:56px; height:56px; border-radius:14px; background:#000; display:inline-block; overflow:hidden; text-align:center;">
                      <img src="${logoUrl}" alt="CMPD" width="56" height="56" style="display:block; width:56px; height:56px; border-radius:14px;" />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="color:#fff; font-size:24px; font-weight:700; padding-bottom:16px;">
                    You're back in.
                  </td>
                </tr>
                <tr>
                  <td style="color:#d4d4d8; font-size:16px; line-height:1.6; padding-bottom:24px;">
                    ${greeting}<br><br>
                    ${fromLine} You can open the app and pick up where you left off.
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:24px;">
                    <a href="${appUrl}/dashboard" style="display:inline-block; background:#facc15; color:#000; padding:14px 28px; border-radius:12px; font-weight:700; text-decoration:none; font-size:16px;">
                      Open CMPD Fitness
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="color:#52525b; font-size:12px; line-height:1.5; border-top:1px solid #27272a; padding-top:16px;">
                    CMPD Fitness
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `

  const result = await resend.emails.send({
    from: getFromInvite(),
    to: email,
    replyTo: await getReplyTo(),
    subject: 'Your CMPD Fitness app access has been restored',
    html,
    tags: [{ name: 'template', value: 'access_restored' }],
  })

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`)
  }

  return { id: result.data?.id }
}

/**
 * Sent to a client when their trainer toggles the access-paused flag ON.
 * The client cannot use the app until access is restored. Tell them why
 * (typically unpaid invoice) and what to do about it.
 */
export async function sendAccessPausedEmail({
  email,
  fullName,
  trainerName,
}: {
  email: string
  fullName?: string | null
  trainerName?: string | null
}): Promise<{ id: string | null | undefined; skipped?: boolean }> {
  if (!(await isEmailEnabled('access_paused'))) {
    return { id: null, skipped: true }
  }
  const resend = getResend()
  const logoUrl = `${getAppUrl()}/logo.svg`
  const greeting = fullName ? `Hi ${fullName.split(' ')[0]},` : 'Hi,'
  const fromLine = trainerName
    ? `Your trainer ${trainerName} has paused your CMPD Fitness app access.`
    : 'Your trainer has paused your CMPD Fitness app access.'

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0; padding:0; background:#0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a; padding:48px 24px;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px; background:#18181b; border-radius:16px; padding:40px;">
                <tr>
                  <td style="padding-bottom:24px;">
                    <div style="width:56px; height:56px; border-radius:14px; background:#000; display:inline-block; overflow:hidden; text-align:center;">
                      <img src="${logoUrl}" alt="CMPD" width="56" height="56" style="display:block; width:56px; height:56px; border-radius:14px;" />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="color:#fff; font-size:24px; font-weight:700; padding-bottom:16px;">
                    Your app access has been paused.
                  </td>
                </tr>
                <tr>
                  <td style="color:#d4d4d8; font-size:16px; line-height:1.6; padding-bottom:24px;">
                    ${greeting}<br><br>
                    ${fromLine} This is usually due to an outstanding payment.
                  </td>
                </tr>
                <tr>
                  <td style="color:#d4d4d8; font-size:16px; line-height:1.6; padding-bottom:24px;">
                    To restore access, please review the most recent payment email from Stripe and complete payment. Once your trainer confirms receipt, your access will be restored automatically.
                  </td>
                </tr>
                <tr>
                  <td style="color:#71717a; font-size:13px; line-height:1.5; padding-bottom:16px;">
                    If you believe this is a mistake, reply to this email and we'll get it sorted.
                  </td>
                </tr>
                <tr>
                  <td style="color:#52525b; font-size:12px; line-height:1.5; border-top:1px solid #27272a; padding-top:16px;">
                    CMPD Fitness
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `

  const result = await resend.emails.send({
    from: getFromInvite(),
    to: email,
    replyTo: await getReplyTo(),
    subject: 'Your CMPD Fitness app access has been paused',
    html,
    tags: [{ name: 'template', value: 'access_paused' }],
  })

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`)
  }

  return { id: result.data?.id }
}

/**
 * Sent to a user immediately after a successful password change.
 * Confirms the change happened and gives them a one-tap path to recover
 * if it wasn't them.
 */
export async function sendPasswordChangedEmail({
  email,
  fullName,
}: {
  email: string
  fullName?: string | null
}): Promise<{ id: string | null | undefined; skipped?: boolean }> {
  if (!(await isEmailEnabled('password_changed'))) {
    return { id: null, skipped: true }
  }
  const resend = getResend()
  const logoUrl = `${getAppUrl()}/logo.svg`
  const appUrl = getAppUrl()
  const greeting = fullName ? `Hi ${fullName.split(' ')[0]},` : 'Hi,'

  // Format timestamp in Adelaide time when Intl supports it; otherwise UTC.
  let when: string
  try {
    when = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Adelaide',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date()) + ' (Adelaide)'
  } catch {
    when = new Date().toUTCString()
  }

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0; padding:0; background:#0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a; padding:48px 24px;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px; background:#18181b; border-radius:16px; padding:40px;">
                <tr>
                  <td style="padding-bottom:24px;">
                    <div style="width:56px; height:56px; border-radius:14px; background:#000; display:inline-block; overflow:hidden; text-align:center;">
                      <img src="${logoUrl}" alt="CMPD" width="56" height="56" style="display:block; width:56px; height:56px; border-radius:14px;" />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="color:#fff; font-size:24px; font-weight:700; padding-bottom:16px;">
                    Your password was changed.
                  </td>
                </tr>
                <tr>
                  <td style="color:#d4d4d8; font-size:16px; line-height:1.6; padding-bottom:24px;">
                    ${greeting}<br><br>
                    Your CMPD Fitness password was changed on ${when}.
                  </td>
                </tr>
                <tr>
                  <td style="color:#fff; font-size:16px; font-weight:700; line-height:1.6; padding-bottom:20px;">
                    If this was you, no further action needed.
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:20px;">
                    <table cellpadding="0" cellspacing="0" style="background:#3f1d1d; border-left:3px solid #ef4444; border-radius:8px;">
                      <tr>
                        <td style="padding:14px 16px; color:#fecaca; font-size:14px; line-height:1.5;">
                          If you didn't make this change, please reset your password immediately and email <a href="mailto:contact@cmpdcollective.com" style="color:#fecaca; text-decoration:underline;">contact@cmpdcollective.com</a>.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:24px;">
                    <a href="${appUrl}/reset-password" style="display:inline-block; background:#facc15; color:#000; padding:14px 28px; border-radius:12px; font-weight:700; text-decoration:none; font-size:16px;">
                      Reset password
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="color:#52525b; font-size:12px; line-height:1.5; border-top:1px solid #27272a; padding-top:16px;">
                    CMPD Fitness
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `

  const result = await resend.emails.send({
    from: getFromInvite(),
    to: email,
    replyTo: await getReplyTo(),
    subject: 'Your CMPD Fitness password was changed',
    html,
    tags: [{ name: 'template', value: 'password_changed' }],
  })

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`)
  }

  return { id: result.data?.id }
}

/**
 * Sent to a client when their trainer assigns them a new program.
 * Nudges them straight into the app to start their first session.
 */
export async function sendProgramAssignedEmail({
  email,
  fullName,
  programName,
  trainerName,
}: {
  email: string
  fullName?: string | null
  programName: string
  trainerName?: string | null
}): Promise<{ id: string | null | undefined; skipped?: boolean }> {
  if (!(await isEmailEnabled('program_assigned'))) {
    return { id: null, skipped: true }
  }
  const resend = getResend()
  const logoUrl = `${getAppUrl()}/logo.svg`
  const appUrl = getAppUrl()
  const greeting = fullName ? `Hi ${fullName.split(' ')[0]},` : 'Hi,'
  const assignerLine = trainerName
    ? `<strong>${trainerName}</strong> has assigned you a new program: <strong>${programName}</strong>`
    : `You've been assigned a new program: <strong>${programName}</strong>`

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0; padding:0; background:#0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a; padding:48px 24px;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px; background:#18181b; border-radius:16px; padding:40px;">
                <tr>
                  <td style="padding-bottom:24px;">
                    <div style="width:56px; height:56px; border-radius:14px; background:#000; display:inline-block; overflow:hidden; text-align:center;">
                      <img src="${logoUrl}" alt="CMPD" width="56" height="56" style="display:block; width:56px; height:56px; border-radius:14px;" />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="color:#fff; font-size:24px; font-weight:700; padding-bottom:16px;">
                    New program ready.
                  </td>
                </tr>
                <tr>
                  <td style="color:#d4d4d8; font-size:16px; line-height:1.6; padding-bottom:24px;">
                    ${greeting}<br><br>
                    ${assignerLine}.
                  </td>
                </tr>
                <tr>
                  <td style="color:#d4d4d8; font-size:16px; line-height:1.6; padding-bottom:24px;">
                    Open the app to see your schedule, exercises, and start your first session.
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:24px;">
                    <a href="${appUrl}/dashboard" style="display:inline-block; background:#facc15; color:#000; padding:14px 28px; border-radius:12px; font-weight:700; text-decoration:none; font-size:16px;">
                      Open CMPD Fitness
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="color:#52525b; font-size:12px; line-height:1.5; border-top:1px solid #27272a; padding-top:16px;">
                    CMPD Fitness
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `

  const subject = trainerName
    ? `${trainerName} just set up a new program for you`
    : 'A new program is ready for you'

  const result = await resend.emails.send({
    from: getFromInvite(),
    to: email,
    replyTo: await getReplyTo(),
    subject,
    html,
    tags: [{ name: 'template', value: 'program_assigned' }],
  })

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`)
  }

  return { id: result.data?.id }
}

/**
 * Sent to a brand-new client immediately after they complete invite
 * acceptance and set their first password. Different from the invite email
 * (which is the "you've been invited" nudge): this fires on the other side
 * of password-set to welcome them in and point them at their dashboard.
 */
export async function sendWelcomeAfterSignupEmail({
  email,
  fullName,
  trainerName,
}: {
  email: string
  fullName?: string | null
  trainerName?: string | null
}): Promise<{ id: string | null | undefined; skipped?: boolean }> {
  if (!(await isEmailEnabled('welcome_after_signup'))) {
    return { id: null, skipped: true }
  }
  const resend = getResend()
  const logoUrl = `${getAppUrl()}/logo.svg`
  const appUrl = getAppUrl()
  const greeting = fullName ? `Hi ${fullName.split(' ')[0]},` : 'Hi,'
  const trainerLine = trainerName
    ? `<br><br>${trainerName} will be checking in on your progress.`
    : ''

  const html = `
    <!doctype html>
    <html>
      <body style="margin:0; padding:0; background:#0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a; padding:48px 24px;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px; background:#18181b; border-radius:16px; padding:40px;">
                <tr>
                  <td style="padding-bottom:24px;">
                    <div style="width:56px; height:56px; border-radius:14px; background:#000; display:inline-block; overflow:hidden; text-align:center;">
                      <img src="${logoUrl}" alt="CMPD" width="56" height="56" style="display:block; width:56px; height:56px; border-radius:14px;" />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="color:#fff; font-size:24px; font-weight:700; padding-bottom:16px;">
                    Welcome aboard.
                  </td>
                </tr>
                <tr>
                  <td style="color:#d4d4d8; font-size:16px; line-height:1.6; padding-bottom:24px;">
                    ${greeting}<br><br>
                    Your account is set up and you're ready to start training.${trainerLine}
                  </td>
                </tr>
                <tr>
                  <td style="color:#d4d4d8; font-size:16px; line-height:1.6; padding-bottom:24px;">
                    Open the app to see your first program and schedule.
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:24px;">
                    <a href="${appUrl}/dashboard" style="display:inline-block; background:#facc15; color:#000; padding:14px 28px; border-radius:12px; font-weight:700; text-decoration:none; font-size:16px;">
                      Open CMPD Fitness
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="color:#52525b; font-size:12px; line-height:1.5; border-top:1px solid #27272a; padding-top:16px;">
                    CMPD Fitness
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `

  const result = await resend.emails.send({
    from: getFromInvite(),
    to: email,
    replyTo: await getReplyTo(),
    subject: 'Welcome to CMPD Fitness — your account is ready',
    html,
    tags: [{ name: 'template', value: 'welcome_after_signup' }],
  })

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`)
  }

  return { id: result.data?.id }
}
