import { validSession } from './session.ts'

const VITE_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173'])

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const site = Deno.env.get('SITE_ORIGIN') ?? ''
  const allowed = VITE_ORIGINS.has(origin) || (site !== '' && origin === site)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (allowed) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
    headers.Vary = 'Origin'
  }
  return headers
}

export function json(req: Request, status: number, body: unknown, extra: Record<string, string> = {}): Response {
  const headers = new Headers(corsHeaders(req))
  headers.set('Content-Type', 'application/json')
  for (const [key, value] of Object.entries(extra)) headers.append(key, value)
  return new Response(JSON.stringify(body), { status, headers })
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}

export async function rejectUnlessSession(req: Request): Promise<Response | null> {
  if (await validSession(req)) return null
  return json(req, 401, { ok: false, error: 'unauthorized' })
}

export function servePost(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) })
    if (req.method !== 'POST') return json(req, 405, { ok: false, error: 'method' })
    try {
      return await handler(req)
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'unavailable')
      return json(req, 500, { ok: false, error: 'unavailable' })
    }
  })
}
