import { expect, test } from 'vitest'
import { createBrowserClient } from './supabase'

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

test('function calls include credentials and table reads do not', async () => {
  const seen: { url: string; credentials: RequestCredentials | undefined }[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    seen.push({ url: requestUrl(input), credentials: init?.credentials })
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const client = createBrowserClient('https://example.supabase.co', 'public-anon-key', fetchImpl)
  const invoked = await client.functions.invoke('inbox-list', { body: {} })
  expect(invoked.error).toBeNull()
  const listed = await client.from('services').select('*')
  expect(listed.error).toBeNull()

  const functions = seen.filter((call) => call.url.includes('/functions/v1'))
  const rest = seen.filter((call) => call.url.includes('/rest/v1'))
  expect(functions.length).toBeGreaterThan(0)
  expect(functions.every((call) => call.credentials === 'include')).toBe(true)
  expect(rest.length).toBeGreaterThan(0)
  expect(rest.every((call) => call.credentials !== 'include')).toBe(true)
})

test('every request carries the public key the way supabase-js sends it', async () => {
  const seen: Headers[] = []
  const fetchImpl: typeof fetch = async (_input, init) => {
    seen.push(new Headers(init?.headers))
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const client = createBrowserClient('https://example.supabase.co/', 'public-anon-key', fetchImpl)
  await client.from('services').select('id')
  await client.functions.invoke('book', { body: {} })
  expect(seen).toHaveLength(2)
  for (const headers of seen) {
    expect(headers.get('apikey')).toBe('public-anon-key')
    expect(headers.get('Authorization')).toBe('Bearer public-anon-key')
  }
})

test('function calls carry the stored admin session token', async () => {
  localStorage.setItem('barber-admin-token', '9999999999.sig')
  const seen: { url: string; session: string | null }[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    seen.push({ url: requestUrl(input), session: new Headers(init?.headers).get('x-admin-session') })
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const client = createBrowserClient('https://example.supabase.co', 'public-anon-key', fetchImpl)
  await client.functions.invoke('inbox-list', { body: {} })
  await client.from('services').select('id')
  localStorage.removeItem('barber-admin-token')
  expect(seen.find((call) => call.url.includes('/functions/v1'))?.session).toBe('9999999999.sig')
  expect(seen.find((call) => call.url.includes('/rest/v1'))?.session).toBeNull()
})
