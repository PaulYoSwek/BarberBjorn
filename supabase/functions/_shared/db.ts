import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export type Db = SupabaseClient

export function serviceClient(): Db {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('missing service role')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
