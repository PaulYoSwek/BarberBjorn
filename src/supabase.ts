import { FunctionsClient } from '@supabase/functions-js'
import { PostgrestClient } from '@supabase/postgrest-js'
import { readAdminToken, SESSION_HEADER } from './admin-session'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

/**
 * The site only reads public tables and calls edge functions, so it uses the
 * two small Supabase clients instead of the full SDK (no auth, realtime or
 * storage code in the bundle). Headers match what supabase-js would send.
 */
export type BackendClient = {
  from: PostgrestClient['from']
  functions: FunctionsClient
}

export function createBrowserClient(
  supabaseUrl: string,
  supabaseKey: string,
  fetchImpl: typeof fetch = fetch,
): BackendClient {
  const base = supabaseUrl.replace(/\/+$/, '')
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  const withAuth: typeof fetch = (input, init) => {
    const merged = new Headers(init?.headers)
    for (const [name, value] of Object.entries(headers)) {
      if (!merged.has(name)) merged.set(name, value)
    }
    if (requestUrl(input).includes('/functions/v1')) {
      const token = readAdminToken()
      if (token && !merged.has(SESSION_HEADER)) merged.set(SESSION_HEADER, token)
      return fetchImpl(input, { ...init, headers: merged, credentials: 'include' })
    }
    return fetchImpl(input, { ...init, headers: merged })
  }
  const rest = new PostgrestClient(`${base}/rest/v1`, { headers, fetch: withAuth })
  const functions = new FunctionsClient(`${base}/functions/v1`, { headers, customFetch: withAuth })
  return {
    from: (relation: string) => rest.from(relation),
    functions,
  } as BackendClient
}

export const supabase = url && key ? createBrowserClient(url, key) : null
