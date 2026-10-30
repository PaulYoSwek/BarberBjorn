/**
 * The appointments as a calendar feed on the site's own address, for Google
 * Calendar, Outlook and Apple Calendar to subscribe to:
 *   https://www.bjornsbarber.nl/api/agenda?token=…
 * Calendar apps cannot send keys, so this route passes the request on to the
 * Supabase function with the public anon key; the secret token in the link is
 * what the function checks.
 */
const TOKEN = /^[A-Za-z0-9_-]{20,128}$/

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Method not allowed')
    return
  }
  const token = typeof req.query?.token === 'string' ? req.query.token : ''
  if (!TOKEN.test(token)) {
    res.status(404).send('Not found')
    return
  }
  const base = (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''
  if (!base || !key) {
    res.status(503).send('Unavailable')
    return
  }
  try {
    const upstream = await fetch(`${base}/functions/v1/calendar-feed?token=${encodeURIComponent(token)}`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    })
    const body = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.ok ? 'text/calendar; charset=utf-8' : 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    if (upstream.ok) res.setHeader('Content-Disposition', 'inline; filename="bjorns-barber.ics"')
    res.send(req.method === 'HEAD' ? '' : body)
  } catch {
    res.status(503).send('Unavailable')
  }
}
