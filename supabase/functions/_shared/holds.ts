import type { Db } from './db.ts'
import { utcToSalonWall } from './salon.ts'

export function sameDayOverlap(
  left: { start: string; minutes: number },
  right: { start: string; minutes: number },
): boolean {
  if (left.start.slice(0, 10) !== right.start.slice(0, 10)) return false
  const startA = clockMinutes(left.start.slice(11, 16))
  const startB = clockMinutes(right.start.slice(11, 16))
  return startA < startB + right.minutes && startB < startA + left.minutes
}

function clockMinutes(stamp: string): number {
  const [hours, minutes] = stamp.split(':').map(Number)
  return hours * 60 + minutes
}

export async function confirmedOverlaps(
  db: Db,
  id: string,
  wall: string,
  minutes: number,
): Promise<{ id: string; created_at: string }[]> {
  const { data, error } = await db.from('bookings').select('id, start, minutes, created_at').eq('status', 'confirmed')
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as { id: string; start: string; minutes: number; created_at: string }[]
  const mineHold = { start: wall, minutes }
  const overlaps: { id: string; created_at: string }[] = []
  for (const other of rows) {
    if (other.id === id) continue
    const otherHold = { start: utcToSalonWall(String(other.start)), minutes: other.minutes }
    if (sameDayOverlap(mineHold, otherHold)) overlaps.push({ id: other.id, created_at: other.created_at })
  }
  return overlaps
}

export function lostOverlapRace(
  mine: { id: string; created_at: string },
  other: { id: string; created_at: string },
): boolean {
  const mineAt = new Date(mine.created_at).getTime()
  const otherAt = new Date(other.created_at).getTime()
  if (otherAt < mineAt) return true
  return otherAt === mineAt && other.id < mine.id
}
