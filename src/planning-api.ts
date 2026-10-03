import type { ServiceId } from './content'
import { defaultSchedule, type DayHours, type Schedule, type ScheduleBlock, type Weekday } from './schedule'
import { supabase } from './supabase'

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

type WeekRow = {
  weekday: string
  closed: boolean
  open: string | null
  close: string | null
}

type BlockRow = {
  date: string
  time: string | null
}

type OccupancyRow = {
  start: string
  minutes: number
}

type ServiceRow = {
  id: string
  price: string
  minutes: number
}

function isWeekday(value: string): value is Weekday {
  return (WEEKDAYS as readonly string[]).includes(value)
}

function isServiceId(value: string): value is ServiceId {
  return value === 'cut' || value === 'beard' || value === 'both'
}

function dayHours(row: WeekRow): DayHours {
  if (row.closed || !row.open || !row.close) return { closed: true }
  return { open: row.open, close: row.close }
}

function localStart(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 19)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function toBlock(row: BlockRow): ScheduleBlock {
  const date = String(row.date).slice(0, 10)
  if (!row.time) return { date }
  return { date, time: row.time.slice(0, 5) }
}

async function read<T>(table: string, columns: string): Promise<T[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(table).select(columns)
  if (error) throw new Error(error.message)
  return (data ?? []) as T[]
}

export async function loadPublicSchedule(): Promise<Schedule> {
  if (!supabase) return defaultSchedule
  const [weekRows, blockRows, occupancy] = await Promise.all([
    read<WeekRow>('schedule_week', 'weekday, closed, open, close'),
    read<BlockRow>('schedule_blocks', 'date, time'),
    read<OccupancyRow>('booking_occupancy', 'start, minutes'),
  ])
  const week = { ...defaultSchedule.week }
  for (const row of weekRows) {
    if (isWeekday(row.weekday)) week[row.weekday] = dayHours(row)
  }
  return {
    week,
    blocks: blockRows.map(toBlock),
    bookings: occupancy.map((row) => ({
      start: localStart(String(row.start)),
      minutes: row.minutes,
    })),
  }
}

export async function loadServices(): Promise<{ id: ServiceId; price: string; minutes: number }[]> {
  if (!supabase) return []
  const rows = await read<ServiceRow>('services', 'id, price, minutes')
  return rows.filter(isServiceRow).map((row) => ({
    id: row.id,
    price: row.price,
    minutes: row.minutes,
  }))
}

function isServiceRow(row: ServiceRow): row is ServiceRow & { id: ServiceId } {
  return isServiceId(row.id)
}
