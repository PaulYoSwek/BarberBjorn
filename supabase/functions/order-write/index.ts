import { serviceClient } from '../_shared/db.ts'
import { json, readJson, rejectUnlessSession, servePost } from '../_shared/http.ts'

const MAX_MONEY = 10_000
const MAX_QTY = 100
const MAX_NAME = 80

type ItemIn = { id?: string; productId: string | null; name: string; listPrice: number; price: number; quantity: number }
type ItemRow = { id: string; product_id: string | null; quantity: number }

function money(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_MONEY) return null
  return Math.round(value * 100) / 100
}

function parseItem(value: unknown): ItemIn | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const name = typeof item.name === 'string' ? item.name.trim() : ''
  const listPrice = money(item.listPrice)
  const price = money(item.price)
  const quantity = item.quantity
  if (!name || name.length > MAX_NAME || listPrice === null || price === null) return null
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) return null
  const productId = typeof item.productId === 'string' && item.productId ? item.productId : null
  const id = typeof item.id === 'string' && item.id ? item.id : undefined
  return { id, productId, name, listPrice, price, quantity }
}

/**
 * Save what an appointment costs: the service price after discount and the
 * products sold with it. Stock moves by the difference with what was saved before.
 */
servePost(async (req) => {
  const denied = await rejectUnlessSession(req)
  if (denied) return denied
  const body = await readJson(req)
  if (!body || typeof body !== 'object') return json(req, 400, { ok: false, error: 'invalid' })
  const record = body as { id?: unknown; charged?: unknown; items?: unknown }
  const id = typeof record.id === 'string' ? record.id : ''
  if (!id || !Array.isArray(record.items)) return json(req, 400, { ok: false, error: 'invalid' })
  const charged = record.charged === null || record.charged === undefined ? null : money(record.charged)
  if (record.charged !== null && record.charged !== undefined && charged === null) {
    return json(req, 400, { ok: false, error: 'invalid' })
  }
  const items: ItemIn[] = []
  for (const raw of record.items) {
    const item = parseItem(raw)
    if (!item) return json(req, 400, { ok: false, error: 'invalid' })
    items.push(item)
  }

  const db = serviceClient()
  const found = await db.from('bookings').select('id').eq('id', id).maybeSingle()
  if (found.error) throw new Error(found.error.message)
  if (!found.data) return json(req, 404, { ok: false, error: 'missing' })

  const existing = await db.from('booking_items').select('id, product_id, quantity').eq('booking_id', id)
  if (existing.error) throw new Error(existing.error.message)
  const before = (existing.data ?? []) as ItemRow[]

  // Stock: what was sold before minus what is sold now, per product.
  const delta = new Map<string, number>()
  for (const row of before) if (row.product_id) delta.set(row.product_id, (delta.get(row.product_id) ?? 0) - row.quantity)
  for (const item of items) if (item.productId) delta.set(item.productId, (delta.get(item.productId) ?? 0) + item.quantity)
  for (const [productId, change] of delta) {
    if (change === 0) continue
    const product = await db.from('products').select('stock').eq('id', productId).maybeSingle()
    if (product.error) throw new Error(product.error.message)
    if (!product.data) continue
    const stock = Number((product.data as { stock: number }).stock) - change
    const moved = await db.from('products').update({ stock }).eq('id', productId)
    if (moved.error) throw new Error(moved.error.message)
  }

  const keep = new Set(items.map((item) => item.id).filter((item): item is string => Boolean(item)))
  const gone = before.filter((row) => !keep.has(row.id)).map((row) => row.id)
  if (gone.length > 0) {
    const removed = await db.from('booking_items').delete().in('id', gone)
    if (removed.error) throw new Error(removed.error.message)
  }
  for (const item of items) {
    const row = {
      booking_id: id,
      product_id: item.productId,
      name: item.name,
      list_price: item.listPrice,
      price: item.price,
      quantity: item.quantity,
    }
    const saved = item.id
      ? await db.from('booking_items').update(row).eq('id', item.id).eq('booking_id', id)
      : await db.from('booking_items').insert(row)
    if (saved.error) throw new Error(saved.error.message)
  }

  const updated = await db.from('bookings').update({ charged }).eq('id', id)
  if (updated.error) throw new Error(updated.error.message)
  return json(req, 200, { ok: true })
})
