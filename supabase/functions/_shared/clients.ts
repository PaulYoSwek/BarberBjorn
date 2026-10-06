import type { Db } from './db.ts'

/** Missing table or column: the clients migration has not run yet. */
export function isSchemaMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    error.code === 'PGRST205' ||
    /does not exist|could not find/i.test(error.message ?? '')
  )
}

/**
 * Add the person who booked to the client list, or fill in a phone number we
 * did not have yet. Never throws: a booking must not fail on this.
 */
export async function rememberClient(db: Db, person: { name: string; email: string; phone: string }): Promise<void> {
  try {
    const email = person.email.trim().toLowerCase()
    if (!email) return
    const found = await db.from('clients').select('id, phone').eq('email', email).maybeSingle()
    if (found.error) return
    const row = found.data as { id: string; phone: string } | null
    if (!row) {
      await db.from('clients').insert({ name: person.name.trim(), email, phone: person.phone.trim() })
      return
    }
    if (!row.phone && person.phone.trim()) {
      await db.from('clients').update({ phone: person.phone.trim() }).eq('id', row.id)
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'remember client failed')
  }
}

/** The current price of a service, stored on the booking. */
export async function servicePrice(db: Db, service: string): Promise<string | null> {
  const { data, error } = await db.from('services').select('price').eq('id', service).maybeSingle()
  if (error || !data) return null
  return (data as { price?: string }).price ?? null
}

/**
 * Insert a booking with its price. Before the clients migration the column
 * does not exist yet, so retry without it instead of losing the booking.
 */
export async function insertBooking(db: Db, row: Record<string, unknown>) {
  const first = await db.from('bookings').insert(row).select('id, created_at').single()
  if (!first.error || !isSchemaMissing(first.error) || !('price' in row)) return first
  const { price: _price, ...rest } = row
  return await db.from('bookings').insert(rest).select('id, created_at').single()
}
