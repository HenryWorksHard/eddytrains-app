import { Resend } from 'resend'

// Transactional email via Resend.
// Replaces the previous Klaviyo integration (removed 2026-04-20).

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

function getReplyTo() {
  return process.env.RESEND_REPLY_TO || 'eddy@cmpdcollective.com'
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
}: SendInviteArgs) {
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
    replyTo: getReplyTo(),
    subject,
    html,
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
}) {
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
    replyTo: getReplyTo(),
    subject: 'Your CMPD Fitness app access has been paused',
    html,
  })

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`)
  }

  return { id: result.data?.id }
}
