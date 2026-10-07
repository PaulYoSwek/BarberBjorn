import { isSchemaMissing } from '../_shared/clients.ts'
import { serviceClient } from '../_shared/db.ts'
import { json, rejectUnlessSession, servePost } from '../_shared/http.ts'

/** Every product, active or not. The dashboard decides what to show. */
servePost(async (req) => {
  const denied = await rejectUnlessSession(req)
  if (denied) return denied
  const db = serviceClient()
  const listed = await db
    .from('products')
    .select('id, name, price, stock, active, created_at')
    .order('active', { ascending: false })
    .order('name')
  if (listed.error) {
    if (isSchemaMissing(listed.error)) return json(req, 200, { ok: true, ready: false, products: [] })
    throw new Error(listed.error.message)
  }
  return json(req, 200, { ok: true, ready: true, products: listed.data ?? [] })
})
