import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export function createBrowserClient(
  supabaseUrl: string,
  supabaseKey: string,
  fetchImpl: typeof fetch = fetch,
): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: (input, init) => fetchImpl(input, { ...init, credentials: 'include' }),
    },
  })
}

export const supabase = url && key ? createBrowserClient(url, key) : null
