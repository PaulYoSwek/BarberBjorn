import type { ServiceId } from '../../../src/content.ts'
import {
  dateIso,
  defaultSchedule,
  SERVICE_MINUTES,
  type DayHours,
  type Schedule,
  type ScheduleBlock,
  type Weekday,
} from '../../../src/schedule.ts'
import type { Db } from './db.ts'
import { salonNow, utcToSalonWall } from './salon.ts'

const PAGE = 1000

/** Blocks from yesterday on, paged so a year of closed half-hours never hits the 1000-row API cap. */
async function readBlocks(db: Db): Promise<BlockRow[]> {
  const today = new Date(salonNow())
  today.setDate(today.getDate() - 1)
  const from = dateIso(today)
  const rows: BlockRow[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await db
      .from('schedule_blocks')
      .select('date, time')
      .gte('date', from)
      .order('date')
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as BlockRow[]
    rows.push(...batch)
    if (batch.length < PAGE) return rows
  }
}

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

type WeekRow = { weekday: string; closed: boolean; open: string | null; close: string | null }
type ExceptionRow = { date: string; closed: boolean; open: string | null; close: string | null }
type BlockRow = { date: string; time: string | null }
type HoldRow = { id: string; start: string; minutes: number }
type ServiceRow = { id: string; minutes: number }

function isWeekday(value: string): value is Weekday {
  return (WEEKDAYS as readonly string[]).includes(value)
}

function isServiceId(value: string): value is ServiceId {
  return value === 'cut' || value === 'beard' || value === 'both'
}

function dayHours(row: WeekRow): DayHours {
  if (row.closed || !row.open || !row.close) return { closed: true }
  return { open: row.open.slice(0, 5), close: row.close.slice(0, 5) }
}

function toBlock(row: BlockRow): ScheduleBlock {
  const date = String(row.date).slice(0, 10)
  if (!row.time) return { date }
  return { date, time: row.time.slice(0, 5) }
}

export async function loadSchedule(db: Db, exceptId?: string): Promise<Schedule> {
  const [weekRes, blockRows, holdRes, serviceRes, exceptionRes] = await Promise.all([
    db.from('schedule_week').select('weekday, closed, open, close'),
    readBlocks(db),
    db.from('bookings').select('id, start, minutes').eq('status', 'confirmed'),
    db.from('services').select('id, minutes'),
    db.from('schedule_exceptions').select('date, closed, open, close'),
  ])
  if (weekRes.error) throw new Error(weekRes.error.message)
  if (holdRes.error) throw new Error(holdRes.error.message)
  if (serviceRes.error) throw new Error(serviceRes.error.message)
  // The exceptions table may not be migrated yet; treat that as "no exceptions".
  const exceptionRows = exceptionRes.error ? [] : ((exceptionRes.data ?? []) as ExceptionRow[])

  const week = { ...defaultSchedule.week }
  for (const row of (weekRes.data ?? []) as WeekRow[]) {
    if (isWeekday(row.weekday)) week[row.weekday] = dayHours(row)
  }

  const exceptions: Record<string, DayHours> = {}
  for (const row of exceptionRows) {
    exceptions[String(row.date).slice(0, 10)] = dayHours({ ...row, weekday: '' })
  }

  const minutes = { ...SERVICE_MINUTES }
  for (const row of (serviceRes.data ?? []) as ServiceRow[]) {
    if (isServiceId(row.id) && Number.isFinite(row.minutes) && row.minutes > 0) minutes[row.id] = row.minutes
  }

  const bookings = ((holdRes.data ?? []) as HoldRow[])
    .filter((row) => row.id !== exceptId)
    .map((row) => ({
      start: utcToSalonWall(String(row.start)),
      minutes: row.minutes,
    }))

  return {
    week,
    exceptions,
    blocks: blockRows.map(toBlock),
    bookings,
    minutes,
  }
}

export function serviceMinutes(schedule: Schedule, service: ServiceId): number {
  return schedule.minutes?.[service] ?? SERVICE_MINUTES[service]
}
