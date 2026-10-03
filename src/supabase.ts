import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

export function createBrowserClient(
  supabaseUrl: string,
  supabaseKey: string,
  fetchImpl: typeof fetch = fetch,
): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: (input, init) => {
        if (requestUrl(input).includes('/functions/v1')) {
          return fetchImpl(input, { ...init, credentials: 'include' })
        }
        return fetchImpl(input, init)
      },
    },
  })
}

export const supabase = url && key ? createBrowserClient(url, key) : null
