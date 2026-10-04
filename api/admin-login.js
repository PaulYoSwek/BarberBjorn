export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false })
    return
  }
  let given = ''
  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body)
      if (typeof parsed?.password === 'string') given = parsed.password
    } catch {
      given = ''
    }
  } else if (typeof req.body?.password === 'string') {
    given = req.body.password
  }
  const expected = process.env.ADMIN_PASSWORD ?? ''
  const ok = expected.length > 0 && given === expected
  res.status(ok ? 200 : 401).json({ ok })
}
