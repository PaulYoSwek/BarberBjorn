import { isSchemaMissing } from '../_shared/clients.ts'
import { serviceClient } from '../_shared/db.ts'
import { json, rejectUnlessSession, servePost } from '../_shared/http.ts'

servePost(async (req) => {
  const denied = await rejectUnlessSession(req)
  if (denied) return denied
  const db = serviceClient()
  const columns = 'id, service, name, email, phone, start, minutes, kind, status, lang, mail_sent'
  const list = (extra: string) =>
    db
      .from('bookings')
      .select(extra ? `${columns}, ${extra}` : columns)
      .order('created_at', { ascending: false })
  // Older databases miss the price or charged column; fall back step by step.
  let listed = await list('price, charged')
  if (listed.error && isSchemaMissing(listed.error)) listed = await list('price')
  if (listed.error && isSchemaMissing(listed.error)) listed = await list('')
  if (listed.error) throw new Error(listed.error.message)
  const rows = (listed.data ?? []) as Record<string, unknown>[]

  // Products sold with each appointment.
  const items = await db
    .from('booking_items')
    .select('id, booking_id, product_id, name, list_price, price, quantity')
    .order('created_at')
  const byBooking = new Map<string, unknown[]>()
  if (!items.error) {
    for (const item of (items.data ?? []) as Record<string, unknown>[]) {
      const key = String(item.booking_id)
      byBooking.set(key, [
        ...(byBooking.get(key) ?? []),
        {
          id: item.id,
          productId: item.product_id,
          name: item.name,
          listPrice: Number(item.list_price),
          price: Number(item.price),
          quantity: Number(item.quantity),
        },
      ])
    }
  } else if (!isSchemaMissing(items.error)) {
    throw new Error(items.error.message)
  }
  return json(
    req,
    200,
    rows.map((row) => ({
      ...row,
      charged: row.charged === null || row.charged === undefined ? null : Number(row.charged),
      items: byBooking.get(String(row.id)) ?? [],
    })),
  )
})
