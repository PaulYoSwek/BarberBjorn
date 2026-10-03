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
