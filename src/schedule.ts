import type { ServiceId } from './content.ts'

/** Every length is a whole number of quarter-hours. */
export const SLOT_MINUTES = 15

/** Length of a service the agenda knows nothing about yet. */
export const DEFAULT_MINUTES = 30

export const SERVICE_MINUTES: Record<ServiceId, number> = {
  cut: 45,
  beard: 30,
  both: 75,
}

/** How many quarter-hour cells a service covers (a length not on the grid rounds up). */
export function spanCells(minutes: number): number {
  return Math.max(1, Math.ceil(minutes / SLOT_MINUTES))
}

/** The slot starts an appointment covers: its own start and the cells after it. */
export function spanStarts(start: string, minutes: number): string[] {
  const date = start.slice(0, 10)
  const first = minutesOf(start.slice(11, 16))
  const starts: string[] = []
  for (let cell = 0; cell < spanCells(minutes); cell++) {
    const at = first + cell * SLOT_MINUTES
    if (at >= 24 * 60) break
    starts.push(`${date}T${clock(at)}:00`)
  }
  return starts
}

export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

export type DayHours = { closed: true } | { open: string; close: string }

export type BookingHold = { start: string; minutes: number }

/** A closed date (no time) or a closed quarter-hour. `reason` and `color` are Bjorn's notes. */
export type ScheduleBlock = { date: string; time?: string; reason?: string; color?: string }

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
  /** The chosen service would overlap a closed or booked time: not bookable. */
  taken: boolean
  /** This quarter-hour itself is closed or booked, exactly as the dashboard shows it. */
  held: boolean
  /** The whole appointment ends by closing time when it starts here. */
  fits: boolean
  past: boolean
}

export type AgendaDay = {
  date: string
  weekday: Weekday
  closed: boolean
  slots: Slot[]
}

/** How far ahead the calendar reaches: 106 weeks from this Monday, so always at least two years. */
export const AGENDA_WEEKS = 106
export const AGENDA_DAYS = AGENDA_WEEKS * 7

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

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA
}


/** Closed days and held times per date, built once so two years of days stay quick to lay out. */
function indexSchedule(schedule: Schedule) {
  const closedDays = new Set<string>()
  const holds = new Map<string, { start: number; end: number }[]>()
  const add = (date: string, hold: { start: number; end: number }) => {
    const list = holds.get(date)
    if (list) list.push(hold)
    else holds.set(date, [hold])
  }
  for (const block of schedule.blocks ?? []) {
    if (!block.time) {
      closedDays.add(block.date)
      continue
    }
    const start = minutesOf(block.time)
    add(block.date, { start, end: start + SLOT_MINUTES })
  }
  for (const hold of schedule.bookings ?? []) {
    const start = minutesOf(hold.start.slice(11, 16))
    add(hold.start.slice(0, 10), { start, end: start + hold.minutes })
  }
  return { closedDays, holds }
}

export function agendaDays(
  service: ServiceId | '',
  now: Date,
  extra: Partial<Schedule> = {},
  /** How many days from this Monday; a single-day check needs far fewer than the whole horizon. */
  count = AGENDA_DAYS,
): AgendaDay[] {
  const schedule: Schedule = {
    week: extra.week ?? defaultSchedule.week,
    exceptions: extra.exceptions ?? defaultSchedule.exceptions,
    blocks: extra.blocks,
    bookings: extra.bookings ?? [],
    minutes: extra.minutes,
  }
  const id = service || 'cut'
  const minutes = schedule.minutes?.[id] ?? SERVICE_MINUTES[id] ?? DEFAULT_MINUTES
  // The grid works in whole cells, so a length off the grid rounds up to the next quarter-hour.
  const span = spanCells(minutes) * SLOT_MINUTES
  const today = dateIso(now)
  const origin = mondayOf(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const index = indexSchedule(schedule)

  return Array.from({ length: count }, (_, offset) => {
    const date = dateIso(addDays(origin, offset))
    const hours: DayHours = index.closedDays.has(date)
      ? { closed: true }
      : (schedule.exceptions?.[date] ?? schedule.week[weekdayOf(localDate(date, '12:00'))])
    const weekday = weekdayOf(localDate(date, '12:00'))
    if ('closed' in hours) {
      return { date, weekday, closed: true, slots: [] }
    }
    const open = minutesOf(hours.open)
    const close = minutesOf(hours.close)
    const held = index.holds.get(date) ?? []
    const slots: Slot[] = []
    // Every quarter-hour up to closing is shown, like the dashboard; late starts simply do not fit.
    for (let start = open; start < close; start += SLOT_MINUTES) {
      const end = start + span
      const fits = end <= close
      const taken = held.some((hold) => overlaps(start, end, hold.start, hold.end))
      const own = held.some((hold) => overlaps(start, start + SLOT_MINUTES, hold.start, hold.end))
      const past = date < today || (date === today && start <= nowMinutes)
      slots.push({
        start: `${date}T${clock(start)}:00`,
        time: clock(start),
        taken,
        held: own,
        fits,
        past,
      })
    }
    return { date, weekday, closed: false, slots }
  })
}

export type MonthCell = { date: string; inMonth: boolean }

/** The 42 cells (six Monday-first weeks) that show a month; days of the neighbouring months are marked. */
export function monthCells(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1, 12)
  const start = addDays(first, -((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, index) => {
    const day = addDays(start, index)
    return { date: dateIso(day), inMonth: day.getMonth() === month }
  })
}

export function monthOf(date: string): { year: number; month: number } {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) - 1 }
}

/** A day with at least one start the chosen service fits in. */
export function hasFreeStart(day: AgendaDay): boolean {
  return !day.closed && day.slots.some((slot) => slot.fits && !slot.taken && !slot.past)
}

export function firstBookableDate(days: AgendaDay[]): string | undefined {
  return days.find(hasFreeStart)?.date
}

export function firstBookableWeek(days: AgendaDay[], size = 7): number {
  const index = days.findIndex((day) => !day.closed && day.slots.some((slot) => slot.fits && !slot.taken && !slot.past))
  return index < 0 ? 0 : Math.floor(index / size)
}
