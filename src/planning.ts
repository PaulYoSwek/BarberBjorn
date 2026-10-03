import type { ServiceId } from './content'
import { agendaDays, type DayHours, type Schedule, type Weekday } from './schedule'

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
  return false
}

export function applyDecision(
  row: { start: string; minutes: number; status: string },
  action: 'accept' | 'decline',
  schedule: Schedule,
  now = new Date(),
): { status: 'confirmed' | 'declined' } | { error: 'overlap' } {
  if (action === 'decline') return { status: 'declined' }
  if (!isFree(row.start, row.minutes, schedule, now)) return { error: 'overlap' }
  return { status: 'confirmed' }
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
