import type { ServiceId } from './content.ts'

export const SERVICE_MINUTES: Record<ServiceId, number> = {
  cut: 45,
  beard: 20,
  both: 60,
}

export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

export type DayHours = { closed: true } | { open: string; close: string }

export type BookingHold = { start: string; minutes: number }

export type ScheduleBlock = { date: string; time?: string }

export type Schedule = {
  week: Record<Weekday, DayHours>
  exceptions?: Record<string, DayHours>
  blocks?: ScheduleBlock[]
  bookings?: BookingHold[]
  minutes?: Record<ServiceId, number>
}

export type Slot = {
  start: string
  time: string
  taken: boolean
  past: boolean
}

export type AgendaDay = {
  date: string
  weekday: Weekday
  closed: boolean
  slots: Slot[]
}

export const AGENDA_DAYS = 28

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export const defaultSchedule: Schedule = {
  week: {
    mon: { open: '09:00', close: '18:00' },
    tue: { open: '09:00', close: '18:00' },
    wed: { open: '09:00', close: '18:00' },
    thu: { open: '09:00', close: '18:00' },
    fri: { open: '09:00', close: '18:00' },
    sat: { closed: true },
    sun: { closed: true },
  },
  bookings: [],
}

export function mondayOf(now: Date): Date {
  const today = localDate(dateIso(now), '12:00')
  const back = (today.getDay() + 6) % 7
  return addDays(today, -back)
}

export function dateIso(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

function weekdayOf(value: Date): Weekday {
  return WEEKDAYS[value.getDay()]
}

function minutesOf(stamp: string): number {
  const [hours, minutes] = stamp.split(':').map(Number)
  return hours * 60 + minutes
}

function clock(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

function localDate(date: string, time = '00:00'): Date {
  return new Date(`${date}T${time}:00`)
}

function addDays(value: Date, count: number): Date {
  const next = new Date(value)
  next.setDate(next.getDate() + count)
  return next
}

function hoursFor(date: string, schedule: Schedule): DayHours {
  if (schedule.blocks?.some((block) => block.date === date && !block.time)) {
    return { closed: true }
  }
  if (schedule.exceptions?.[date]) return schedule.exceptions[date]
  return schedule.week[weekdayOf(localDate(date, '12:00'))]
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA
}

function holdsOn(date: string, schedule: Schedule): { start: number; end: number }[] {
  const fromBlocks = (schedule.blocks ?? [])
    .filter((block) => block.date === date && block.time)
    .map((block) => {
      const start = minutesOf(block.time!)
      return { start, end: start + 30 }
    })
  const fromBookings = (schedule.bookings ?? [])
    .filter((hold) => hold.start.startsWith(date))
    .map((hold) => {
      const time = hold.start.slice(11, 16)
      const start = minutesOf(time)
      return { start, end: start + hold.minutes }
    })
  return [...fromBlocks, ...fromBookings]
}

export function agendaDays(
  service: ServiceId | '',
  now: Date,
  extra: Partial<Schedule> = {},
): AgendaDay[] {
  const schedule: Schedule = {
    week: extra.week ?? defaultSchedule.week,
    exceptions: extra.exceptions ?? defaultSchedule.exceptions,
    blocks: extra.blocks,
    bookings: extra.bookings ?? [],
    minutes: extra.minutes,
  }
  const minutes = (schedule.minutes ?? SERVICE_MINUTES)[service || 'cut']
  const today = dateIso(now)
  const origin = mondayOf(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return Array.from({ length: AGENDA_DAYS }, (_, index) => {
    const date = dateIso(addDays(origin, index))
    const hours = hoursFor(date, schedule)
    const weekday = weekdayOf(localDate(date, '12:00'))
    if ('closed' in hours) {
      return { date, weekday, closed: true, slots: [] }
    }
    const open = minutesOf(hours.open)
    const close = minutesOf(hours.close)
    const held = holdsOn(date, schedule)
    const slots: Slot[] = []
    for (let start = open; start + minutes <= close; start += 30) {
      const end = start + minutes
      const taken = held.some((hold) => overlaps(start, end, hold.start, hold.end))
      const past = date < today || (date === today && start <= nowMinutes)
      slots.push({
        start: `${date}T${clock(start)}:00`,
        time: clock(start),
        taken,
        past,
      })
    }
    return { date, weekday, closed: false, slots }
  })
}

export function firstBookableWeek(days: AgendaDay[], size = 7): number {
  const index = days.findIndex((day) => !day.closed && day.slots.some((slot) => !slot.taken && !slot.past))
  return index < 0 ? 0 : Math.floor(index / size)
}
