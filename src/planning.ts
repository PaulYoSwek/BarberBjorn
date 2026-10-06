import type { ServiceId } from './content.ts'
import { agendaDays, type DayHours, type Schedule, type Weekday } from './schedule.ts'

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
      return { start, end: start + 30 }
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
