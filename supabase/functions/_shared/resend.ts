export type OutgoingMail = {
  to: string
  subject: string
  text: string
  html?: string
  /** Where a reply goes; defaults to Bjorn's own inbox (BJORN_EMAIL). */
  replyTo?: string
}

/** Bjorn's own inbox: replies from clients land here, and so do new-booking notices. */
export function bjornEmail(): string {
  return (Deno.env.get('BJORN_EMAIL') ?? '').trim()
}

export async function sendResend(mail: OutgoingMail): Promise<{ sent: boolean }> {
  try {
    const key = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('RESEND_FROM')
    if (!key || !from || !mail.to.trim()) return { sent: false }
    const replyTo = (mail.replyTo ?? bjornEmail()).trim()
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [mail.to.trim()],
        subject: mail.subject,
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })
    if (!response.ok) {
      console.error(`resend ${response.status}: ${(await response.text()).slice(0, 300)}`)
      return { sent: false }
    }
    return { sent: true }
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'resend failed')
    return { sent: false }
  }
}
