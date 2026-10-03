import { expect, test } from 'vitest'
import { createBrowserClient } from './supabase'

test('function calls include credentials', async () => {
  const seen: RequestInit[] = []
  const fetchImpl: typeof fetch = async (_input, init) => {
    seen.push(init ?? {})
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const client = createBrowserClient('https://example.supabase.co', 'public-anon-key', fetchImpl)
  const result = await client.functions.invoke('inbox-list', { body: {} })
  expect(result.error).toBeNull()
  expect(seen.length).toBeGreaterThan(0)
  expect(seen.every((init) => init.credentials === 'include')).toBe(true)
})
