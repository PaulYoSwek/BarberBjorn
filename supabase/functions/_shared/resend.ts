export async function sendResend(to: string, subject: string, text: string): Promise<{ sent: boolean }> {
  try {
    const key = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('RESEND_FROM')
    if (!key || !from || !to.trim()) return { sent: false }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to.trim()],
        subject,
        text,
      }),
    })
    if (!response.ok) return { sent: false }
    return { sent: true }
  } catch {
    return { sent: false }
  }
}
