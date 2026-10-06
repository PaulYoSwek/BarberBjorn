import type { ServiceId } from './content.ts'
import { agendaDays, SLOT_MINUTES, type DayHours, type Schedule, type Weekday } from './schedule.ts'

function clockMinutes(stamp: string): number {
  const [hours, minutes] = stamp.split(':')
  return Number(hours) * 60 + Number(minutes)
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA
}

function holdsOn(date: string, schedule: Schedule): { start: number; end: number }[] {
  const dayBlocked = (schedule.blocks ?? []).some((block) => block.date === date && !block.time)
  if (dayBlocked) return [{ start: 0, end: 24 * 60 }]
  const fromBlocks = (schedule.blocks ?? [])
    .filter((block) => block.date === date && block.time)
    .map((block) => {
      const start = clockMinutes(block.time!.slice(0, 5))
      return { start, end: start + SLOT_MINUTES }
    })
  const fromBookings = (schedule.bookings ?? [])
    .filter((hold) => hold.start.startsWith(date))
    .map((hold) => {
      const start = clockMinutes(hold.start.slice(11, 16))
      return { start, end: start + hold.minutes }
    })
  return [...fromBlocks, ...fromBookings]
}

export function weekHoursFromDays(
  days: { weekday: Weekday; hours: DayHours }[],
): Record<Weekday, DayHours> {
  const week = {} as Record<Weekday, DayHours>
  for (const { weekday, hours } of days) {
    week[weekday] = hours
  }
  return week
}

export function isFree(
  start: string,
  minutes: number,
  schedule: Schedule,
  now = new Date(),
): boolean {
  const startAt = new Date(start)
  if (startAt.getTime() <= now.getTime()) {
    return false
  }
  const date = start.slice(0, 10)
  const days = agendaDays('cut', new Date(`${date}T00:00:00`), {
    ...schedule,
    minutes: { cut: minutes, beard: minutes, both: minutes } as Record<ServiceId, number>,
  })
  for (const day of days) {
    const found = day.slots.find((slot) => slot.start === start)
    if (found) {
      return !found.taken && !found.past
    }
  }
  const startMin = clockMinutes(start.slice(11, 16))
  const endMin = startMin + minutes
  return !holdsOn(date, schedule).some((hold) => rangesOverlap(startMin, endMin, hold.start, hold.end))
}

export type DecisionResult =
  | { status: 'confirmed' | 'declined' }
  | { error: 'overlap' }
  | { noop: true }

export function applyDecision(
  row: { start: string; minutes: number; status: string },
  action: 'accept' | 'decline',
  schedule: Schedule,
  now = new Date(),
): DecisionResult {
  if (row.status !== 'pending') return { noop: true }
  if (action === 'decline') return { status: 'declined' }
  if (!isFree(row.start, row.minutes, schedule, now)) return { error: 'overlap' }
  return { status: 'confirmed' }
}

export function decisionMail(
  decision: DecisionResult,
  action: 'accept' | 'decline',
): 'accepted' | 'declined' | null {
  if (!('status' in decision)) return null
  return action === 'accept' ? 'accepted' : 'declined'
}

export function fillTemplate(
  body: string,
  vars: { name: string; service: string; date: string; time: string },
): string {
  return body
    .replaceAll('{{name}}', vars.name)
    .replaceAll('{{service}}', vars.service)
    .replaceAll('{{date}}', vars.date)
    .replaceAll('{{time}}', vars.time)
}

const WEEKDAY_ORDER: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** How far "Kopieer naar aankomende weken" stamps closed half-hours ahead. */
export const COPY_WEEKS = 52

/** The date `count` days after an ISO date (calendar math in UTC, so DST never shifts the day). */
export function addDaysIso(date: string, count: number): string {
  const day = new Date(`${date}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() + count)
  return day.toISOString().slice(0, 10)
}

/** One closed quarter-hour in a weekly pattern, with Bjorn's note and colour. */
export type BlockPattern = { time: string; reason?: string; color?: string }

export type BlockRow = { date: string; time: string; reason: string; color: string }

/**
 * Closed quarter-hours for every date from `from` for `weeks` weeks, following a
 * per-weekday pattern (e.g. mon: [{ time: '12:00', reason: 'Lunch' }, ...]).
 */
export function weeklyBlockRows(
  from: string,
  weeks: number,
  pattern: Partial<Record<Weekday, BlockPattern[]>>,
): BlockRow[] {
  const rows: BlockRow[] = []
  for (let index = 0; index < weeks * 7; index++) {
    const date = addDaysIso(from, index)
    const weekday = WEEKDAY_ORDER[new Date(`${date}T12:00:00Z`).getUTCDay()]
    for (const entry of pattern[weekday] ?? []) {
      rows.push({ date, time: entry.time, reason: entry.reason ?? '', color: entry.color ?? '' })
    }
  }
  return rows
}
