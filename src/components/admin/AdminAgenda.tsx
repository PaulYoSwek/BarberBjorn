import { useEffect, useMemo, useRef, useState } from 'react'
import { copy } from '../../content'
import { copyWeekClosures, weekHoursFromDays } from '../../planning'
import { adminWrite, loadPublicSchedule, publishLiveSchedule, type InboxRow } from '../../planning-api'
import {
  agendaDays,
  defaultSchedule,
  SERVICE_MINUTES,
  type AgendaDay,
  type DayHours,
  type Schedule,
  type Weekday,
} from '../../schedule'
import { DEMO_INBOX, serviceName } from './admin-defaults'

const WEEK = 7

function minutesOf(stamp: string): number {
  const [hours, minutes] = stamp.split(':').map(Number)
  return hours * 60 + minutes
}

function clock(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

function daySlotTimes(hours: DayHours): string[] {
  if ('closed' in hours) return []
  const open = minutesOf(hours.open)
  const close = minutesOf(hours.close)
  if (!Number.isFinite(open) || !Number.isFinite(close) || close < open) return []
  const times: string[] = []
  for (let start = open; start <= close; start += 30) times.push(clock(start))
  return times
}

function dayName(weekday: Weekday): string {
  return copy.nl.days.find((item) => item.key === weekday)?.label ?? weekday
}

function dayStamp(day: { date: string; weekday: Weekday }): string {
  const month = copy.nl.monthShort[Number(day.date.slice(5, 7)) - 1]
  return `${dayName(day.weekday)} ${Number(day.date.slice(8, 10))} ${month}`
}

function dayChip(day: { date: string; weekday: Weekday }, hours: DayHours): string {
  const span = 'closed' in hours ? 'dicht' : `${hours.open}–${hours.close}`
  return `${dayStamp(day)} ${span}`
}

function weekTitle(days: AgendaDay[]): string {
  if (days.length === 0) return ''
  const first = days[0]
  const last = days[days.length - 1]
  const a = `${Number(first.date.slice(8, 10))} ${copy.nl.monthShort[Number(first.date.slice(5, 7)) - 1]}`
  const b = `${Number(last.date.slice(8, 10))} ${copy.nl.monthShort[Number(last.date.slice(5, 7)) - 1]}`
  return `${a} – ${b}`
}

function booked(date: string, time: string, schedule: Schedule): boolean {
  const start = minutesOf(time)
  const end = start + 30
  return (schedule.bookings ?? []).some((hold) => {
    if (!hold.start.startsWith(date)) return false
    const holdStart = minutesOf(hold.start.slice(11, 16))
    return start < holdStart + hold.minutes && holdStart < end
  })
}

function blocked(date: string, time: string, schedule: Schedule): boolean {
  return (schedule.blocks ?? []).some((block) => block.date === date && block.time === time)
}

function blockKey(date: string, time: string): string {
  return `${date}|${time}`
}

const BLOCKS_KEY = 'barber-admin-blocks'
const WEEK_KEY = 'barber-admin-week'
const EDITS_KEY = 'barber-admin-edits'

function readStoredWeek(): Record<Weekday, DayHours> | null {
  try {
    const raw = sessionStorage.getItem(WEEK_KEY)
    return raw ? (JSON.parse(raw) as Record<Weekday, DayHours>) : null
  } catch {
    return null
  }
}

function writeStoredWeek(week: Record<Weekday, DayHours>) {
  sessionStorage.setItem(WEEK_KEY, JSON.stringify(week))
}

function readStoredEdits(): Record<string, DayHours> {
  try {
    const raw = sessionStorage.getItem(EDITS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, DayHours>) : {}
  } catch {
    return {}
  }
}

function writeStoredEdits(edits: Record<string, DayHours>) {
  sessionStorage.setItem(EDITS_KEY, JSON.stringify(edits))
}

function withSessionWeek(next: Schedule, week: Record<Weekday, DayHours> | null): Schedule {
  return week ? { ...next, week } : next
}

function readStoredBlocks(): Map<string, boolean> {
  try {
    const raw = sessionStorage.getItem(BLOCKS_KEY)
    if (!raw) return new Map()
    return new Map(JSON.parse(raw) as [string, boolean][])
  } catch {
    return new Map()
  }
}

function writeStoredBlocks(map: Map<string, boolean>) {
  sessionStorage.setItem(BLOCKS_KEY, JSON.stringify([...map]))
}

function withSessionBlocks(next: Schedule, session: ReadonlyMap<string, boolean>): Schedule {
  if (session.size === 0) return next
  let blocks = [...(next.blocks ?? [])]
  for (const [key, on] of session) {
    const split = key.indexOf('|')
    const date = key.slice(0, split)
    const time = key.slice(split + 1)
    blocks = blocks.filter((block) => !(block.date === date && block.time === time))
    if (on) blocks.push({ date, time })
  }
  return { ...next, blocks }
}

function withClientHolds(schedule: Schedule, people: InboxRow[]): Schedule {
  const extra = people
    .filter((row) => row.status === 'confirmed')
    .map((row) => ({ start: row.start, minutes: SERVICE_MINUTES[row.service] }))
  if (extra.length === 0) return schedule
  const bookings = [...(schedule.bookings ?? [])]
  const seen = new Set(bookings.map((item) => item.start))
  for (const hold of extra) {
    if (!seen.has(hold.start)) bookings.push(hold)
  }
  return { ...schedule, bookings }
}

function clientAt(date: string, time: string, people: InboxRow[]): InboxRow | undefined {
  const start = minutesOf(time)
  const end = start + 30
  return people.find((row) => {
    if (row.status !== 'confirmed') return false
    if (!row.start.startsWith(date)) return false
    const holdStart = minutesOf(row.start.slice(11, 16))
    const minutes = SERVICE_MINUTES[row.service]
    return start < holdStart + minutes && holdStart < end
  })
}

function windowDays(now: Date, schedule: Schedule): AgendaDay[] {
  return agendaDays('cut', now, {
    week: schedule.week,
    exceptions: schedule.exceptions,
    blocks: schedule.blocks,
    bookings: schedule.bookings,
  })
}

const STATUS_LABEL: Record<InboxRow['status'], string> = {
  pending: 'In afwachting',
  confirmed: 'Bevestigd',
  declined: 'Geweigerd',
}

type Props = { clients?: InboxRow[] }

export function AdminAgenda({ clients = [] }: Props) {
  const people = clients.length ? clients : DEMO_INBOX
  const [schedule, setSchedule] = useState<Schedule>(() =>
    withSessionBlocks(
      withSessionWeek(withClientHolds(defaultSchedule, people), readStoredWeek()),
      readStoredBlocks(),
    ),
  )
  const [edits, setEdits] = useState<Record<string, DayHours>>(readStoredEdits)
  const [week, setWeek] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [detail, setDetail] = useState<InboxRow | null>(null)
  const sessionBlocks = useRef(readStoredBlocks())

  useEffect(() => {
    let cancelled = false
    loadPublicSchedule()
      .then((next) => {
        if (cancelled) return
        const seeded = next.bookings?.length ? next : { ...next, bookings: defaultSchedule.bookings }
        setSchedule(() =>
          withSessionBlocks(withSessionWeek(seeded, readStoredWeek()), sessionBlocks.current),
        )
        setEdits(readStoredEdits())
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setNotice('Agenda laden mislukt.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const view = useMemo(() => withClientHolds(schedule, people), [people, schedule])
  const days = useMemo(() => windowDays(new Date(), view), [view])

  useEffect(() => {
    publishLiveSchedule({
      week: schedule.week,
      blocks: view.blocks,
      exceptions: edits,
      bookings: view.bookings,
    })
  }, [edits, schedule, view])
  const visible = days.slice(week * WEEK, week * WEEK + WEEK)
  const lastWeek = Math.ceil(days.length / WEEK) - 1
  function hoursFor(day: { date: string; weekday: Weekday }): DayHours {
    if ((view.blocks ?? []).some((block) => block.date === day.date && !block.time)) {
      return { closed: true }
    }
    return edits[day.date] ?? schedule.week[day.weekday]
  }
  const fallback = visible.find((day) => !('closed' in hoursFor(day)))?.date ?? visible[0]?.date
  const selected = picked.filter((date) => visible.some((day) => day.date === date))
  const selectedDates = selected.length > 0 ? selected : fallback ? [fallback] : []
  const selectedDays = visible.filter((day) => selectedDates.includes(day.date))
  const hoursDay = selectedDays.find((day) => !('closed' in hoursFor(day))) ?? selectedDays[0]

  async function toggle(date: string, time: string, on: boolean) {
    sessionBlocks.current.set(blockKey(date, time), on)
    writeStoredBlocks(sessionBlocks.current)
    setSchedule((current) => {
      const blocks = (current.blocks ?? []).filter((block) => !(block.date === date && block.time === time))
      if (on) blocks.push({ date, time })
      return { ...current, blocks }
    })
    try {
      const result = await adminWrite({ type: 'blocks', date, time, on })
      if (!result.ok) {
        setNotice('Lokaal dichtgezet. Cloud opslaan lukt nog niet.')
        return
      }
      setNotice(null)
    } catch {
      setNotice('Lokaal dichtgezet. Cloud opslaan lukt nog niet.')
    }
  }

  async function apply() {
    if (!ready || visible.length === 0) return
    const pageDates = visible.map((day) => day.date)
    const later = days.filter((day) => !pageDates.includes(day.date))
    const next = weekHoursFromDays(visible.map((day) => ({ weekday: day.weekday, hours: hoursFor(day) })))
    const blocks = copyWeekClosures(visible, later, schedule.blocks ?? [])
    sessionBlocks.current = new Map(blocks.map((block) => [blockKey(block.date, block.time ?? ''), true]))
    writeStoredBlocks(sessionBlocks.current)
    writeStoredWeek(next)
    setSchedule((current) => ({ ...current, week: next, blocks }))
    setEdits((current) => {
      const kept = { ...current }
      for (const date of pageDates) delete kept[date]
      writeStoredEdits(kept)
      return kept
    })
    try {
      const result = await adminWrite({ type: 'week', week: next })
      if (!result.ok) {
        setNotice('Lokaal opgeslagen. Cloud opslaan lukt nog niet.')
        return
      }
      setNotice(null)
    } catch {
      setNotice('Lokaal opgeslagen. Cloud opslaan lukt nog niet.')
    }
  }

  const hours = hoursDay ? hoursFor(hoursDay) : null

  function slotState(date: string, time: string): 'booked' | 'shut' | 'vrij' {
    if (booked(date, time, view)) return 'booked'
    if (blocked(date, time, view)) return 'shut'
    return 'vrij'
  }

  function remember(next: DayHours) {
    if (!ready || selectedDates.length === 0) return
    const weekHours = { ...schedule.week }
    for (const day of selectedDays) weekHours[day.weekday] = next
    setEdits((current) => {
      const merged = { ...current }
      for (const date of selectedDates) merged[date] = next
      writeStoredEdits(merged)
      return merged
    })
    setSchedule((current) => ({ ...current, week: weekHours }))
    writeStoredWeek(weekHours)
    void adminWrite({ type: 'week', week: weekHours }).then((result) => {
      if (!result.ok) setNotice('Lokaal op de site gezet. Cloud opslaan lukt nog niet.')
    })
  }

  function togglePick(date: string) {
    setPicked((current) => {
      const inView = current.filter((item) => visible.some((day) => day.date === item))
      const basis = inView.length > 0 ? inView : fallback ? [fallback] : []
      if (basis.includes(date)) {
        return basis.length === 1 ? basis : basis.filter((item) => item !== date)
      }
      return [...basis, date]
    })
  }

  function closeDay(date: string, on: boolean) {
    if (!ready) return
    const hours = on ? ({ closed: true } as const) : { open: '09:00', close: '18:00' }
    setPicked((current) => {
      const inView = current.filter((item) => visible.some((row) => row.date === item))
      return inView.includes(date) ? inView : [...inView, date]
    })
    setEdits((current) => {
      const merged = { ...current, [date]: hours }
      writeStoredEdits(merged)
      return merged
    })
    sessionBlocks.current.set(blockKey(date, ''), on)
    writeStoredBlocks(sessionBlocks.current)
    setSchedule((current) => {
      const blocks = (current.blocks ?? []).filter((block) => !(block.date === date && !block.time))
      if (on) blocks.push({ date })
      return { ...current, blocks }
    })
    void adminWrite({ type: 'blocks', date, time: '', on })
  }

  return (
    <div className="admin-agenda">
      <header className="admin-agenda-head">
        <div>
          <p className="admin-kicker">Planning</p>
          <h1>Weekoverzicht</h1>
        </div>
        <ul className="admin-legend">
          <li className="is-vrij">vrij</li>
          <li className="is-shut">dicht</li>
          <li className="is-booked">geboekt</li>
        </ul>
      </header>
      <div className="admin-toolbar">
        <div className="admin-week">
          <button type="button" disabled={week === 0} onClick={() => setWeek((current) => current - 1)}>
            Vorige week
          </button>
          <p className="admin-week-title">{weekTitle(visible)}</p>
          <button type="button" disabled={week >= lastWeek} onClick={() => setWeek((current) => current + 1)}>
            Volgende week
          </button>
        </div>
        <button
          type="button"
          className="admin-copy-week"
          disabled={!ready}
          onClick={() => {
            void apply()
          }}
        >
          Kopieer naar aankomende weken
        </button>
        {hoursDay && hours ? (
          <section className="admin-hours">
            <p className="admin-hours-title">Opening {selectedDays.map((day) => dayStamp(day)).join(', ')}</p>
            <div className="admin-hours-row">
              {'closed' in hours ? (
                <p className="admin-hours-closed">Deze dag is dicht. Zet hem open in de kolom.</p>
              ) : (
                <>
                  <label>
                    Open
                    <input
                      type="time"
                      value={hours.open}
                      disabled={!ready}
                      onChange={(event) => remember({ open: event.target.value, close: hours.close })}
                    />
                  </label>
                  <label>
                    Sluit
                    <input
                      type="time"
                      value={hours.close}
                      disabled={!ready}
                      onChange={(event) => remember({ open: hours.open, close: event.target.value })}
                    />
                  </label>
                </>
              )}
            </div>
          </section>
        ) : null}
      </div>
      <p className="admin-hint">
        Tik dagen aan om ze samen in te stellen. Kopieer naar aankomende weken zet deze week als standaard. Geboekt
        opent de klant.
      </p>
      {notice ? <p role="alert">{notice}</p> : null}
      {detail ? (
        <div className="admin-booking" role="dialog" aria-label="Boeking">
          <p className="admin-kicker">Boeking</p>
          <h2>{detail.name}</h2>
          <p>{serviceName(detail.service)}</p>
          <p>{detail.email}</p>
          {detail.phone ? <p>{detail.phone}</p> : null}
          <p>
            {detail.start.slice(0, 10)} {detail.start.slice(11, 16)}
          </p>
          <p>{STATUS_LABEL[detail.status]}</p>
          <p>{detail.kind === 'custom' ? 'Ander tijdstip' : 'Slot'}</p>
          {detail.mail_sent ? null : <p>Mail niet gegaan</p>}
          <button type="button" onClick={() => setDetail(null)}>
            Sluiten
          </button>
        </div>
      ) : null}
      <div className="agenda admin-week-grid">
        {visible.map((day) => {
          const dayHours = hoursFor(day)
          const closed = 'closed' in dayHours
          const stamp = dayStamp(day)
          return (
            <div
              key={day.date}
              className={`agenda-day admin-col${closed ? ' is-closed' : ''}${selectedDates.includes(day.date) ? ' is-on' : ''}`}
            >
              <button
                type="button"
                className="agenda-when admin-col-head"
                aria-pressed={selectedDates.includes(day.date)}
                aria-label={dayChip(day, dayHours)}
                onClick={() => togglePick(day.date)}
              >
                <strong>{stamp}</strong>
                <span>{closed ? 'dicht' : `${dayHours.open}–${dayHours.close}`}</span>
              </button>
              <button
                type="button"
                className={`admin-day-toggle${closed ? ' is-on' : ''}`}
                aria-pressed={closed}
                aria-label={`${stamp} hele dag dicht`}
                disabled={!ready}
                onClick={() => closeDay(day.date, !closed)}
              >
                Dag dicht
              </button>
              {!closed ? (
                <div className="agenda-slots admin-col-slots">
                  {daySlotTimes(dayHours).map((time) => {
                    const state = slotState(day.date, time)
                    const client = state === 'booked' ? clientAt(day.date, time, people) : undefined
                    const label = state === 'booked' ? 'geboekt' : state === 'shut' ? 'dicht' : 'vrij'
                    const who = client ? ` ${client.name}` : ''
                    return (
                      <button
                        key={time}
                        type="button"
                        className={`admin-cell is-${state}`}
                        aria-pressed={state === 'shut'}
                        aria-label={`${stamp} ${time} ${label}${who}`}
                        onClick={() => {
                          if (state === 'booked') {
                            if (client) setDetail(client)
                            return
                          }
                          void toggle(day.date, time, state !== 'shut')
                        }}
                      >
                        <span>{time}</span>
                        {client ? <span className="admin-cell-name">{client.name}</span> : <span>{label}</span>}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
