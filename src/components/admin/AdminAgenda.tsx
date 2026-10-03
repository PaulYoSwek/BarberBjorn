import { useEffect, useMemo, useRef, useState } from 'react'
import { copy } from '../../content'
import { weekHoursFromDays } from '../../planning'
import { adminWrite, loadPublicSchedule } from '../../planning-api'
import {
  agendaDays,
  defaultSchedule,
  type AgendaDay,
  type DayHours,
  type Schedule,
  type Weekday,
} from '../../schedule'

const WEEK = 7

function toMinutes(stamp: string): number {
  const [hours, minutes] = stamp.split(':').map(Number)
  return hours * 60 + minutes
}

function clock(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

function halfHours(hours: DayHours): string[] {
  if ('closed' in hours) return []
  const open = toMinutes(hours.open)
  const close = toMinutes(hours.close)
  if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open) return []
  const times: string[] = []
  for (let start = open; start + 30 <= close; start += 30) times.push(clock(start))
  return times
}

function dayChip(day: { date: string; weekday: Weekday }, hours: DayHours): string {
  const name = copy.nl.days.find((item) => item.key === day.weekday)?.label ?? day.weekday
  const month = copy.nl.monthShort[Number(day.date.slice(5, 7)) - 1]
  const when = `${name} ${Number(day.date.slice(8, 10))} ${month}`
  const span = 'closed' in hours ? 'dicht' : `${hours.open}–${hours.close}`
  return `${when} ${span}`
}

function booked(date: string, time: string, schedule: Schedule): boolean {
  const start = toMinutes(time)
  const end = start + 30
  return (schedule.bookings ?? []).some((hold) => {
    if (!hold.start.startsWith(date)) return false
    const holdStart = toMinutes(hold.start.slice(11, 16))
    return start < holdStart + hold.minutes && holdStart < end
  })
}

function blocked(date: string, time: string, schedule: Schedule): boolean {
  return (schedule.blocks ?? []).some((block) => block.date === date && block.time === time)
}

function blockKey(date: string, time: string): string {
  return `${date}|${time}`
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

function windowDays(now: Date, schedule: Schedule): AgendaDay[] {
  return agendaDays('cut', now, {
    week: schedule.week,
    exceptions: schedule.exceptions,
    blocks: schedule.blocks,
    bookings: schedule.bookings,
  })
}

export function AdminAgenda() {
  const [schedule, setSchedule] = useState<Schedule>(defaultSchedule)
  const [edits, setEdits] = useState<Record<string, DayHours>>({})
  const [week, setWeek] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const sessionBlocks = useRef(new Map<string, boolean>())

  useEffect(() => {
    let cancelled = false
    loadPublicSchedule()
      .then((next) => {
        if (cancelled) return
        setSchedule(() => withSessionBlocks(next, sessionBlocks.current))
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setNotice('Agenda laden mislukt.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const days = useMemo(() => windowDays(new Date(), schedule), [schedule])
  const visible = days.slice(week * WEEK, week * WEEK + WEEK)
  const lastWeek = Math.ceil(days.length / WEEK) - 1
  const selected = visible.some((day) => day.date === picked) ? picked : visible[0]?.date
  const selectedDay = visible.find((day) => day.date === selected) ?? visible[0]

  function hoursFor(day: { date: string; weekday: Weekday }): DayHours {
    return edits[day.date] ?? schedule.week[day.weekday]
  }

  async function toggle(date: string, time: string, on: boolean) {
    try {
      const result = await adminWrite({ type: 'blocks', date, time, on })
      if (!result.ok) return
      sessionBlocks.current.set(blockKey(date, time), on)
      setSchedule((current) => {
        const blocks = (current.blocks ?? []).filter((block) => !(block.date === date && block.time === time))
        if (on) blocks.push({ date, time })
        return { ...current, blocks }
      })
    } catch {
      return
    }
  }

  async function apply() {
    if (!ready || !selectedDay) return
    const pageDates = visible.map((day) => day.date)
    const next = weekHoursFromDays(visible.map((day) => ({ weekday: day.weekday, hours: hoursFor(day) })))
    try {
      const result = await adminWrite({ type: 'week', week: next })
      if (!result.ok) {
        setNotice('Uren opslaan mislukt.')
        return
      }
      setSchedule((current) => ({ ...current, week: next }))
      setEdits((current) => {
        const kept = { ...current }
        for (const date of pageDates) delete kept[date]
        return kept
      })
      setNotice(null)
    } catch {
      setNotice('Uren opslaan mislukt.')
    }
  }

  const hours = selectedDay ? hoursFor(selectedDay) : null
  const times = selectedDay && hours ? halfHours(hours) : []

  return (
    <div className="admin-agenda">
      <div className="admin-week">
        <button type="button" aria-label="Vorige week" disabled={week === 0} onClick={() => setWeek((current) => current - 1)}>
          ←
        </button>
        <button
          type="button"
          aria-label="Volgende week"
          disabled={week >= lastWeek}
          onClick={() => setWeek((current) => current + 1)}
        >
          →
        </button>
      </div>
      <div className="admin-days">
        {visible.map((day) => {
          const dayHours = hoursFor(day)
          return (
            <button
              key={day.date}
              type="button"
              aria-pressed={day.date === selected}
              onClick={() => setPicked(day.date)}
            >
              {dayChip(day, dayHours)}
            </button>
          )
        })}
      </div>
      {selectedDay && hours ? (
        <div className="admin-hours">
          {'closed' in hours ? null : (
            <>
              <label>
                Open
                <input
                  type="time"
                  value={hours.open}
                  onChange={(event) =>
                    setEdits((current) => ({
                      ...current,
                      [selectedDay.date]: { open: event.target.value, close: hours.close },
                    }))
                  }
                />
              </label>
              <label>
                Sluit
                <input
                  type="time"
                  value={hours.close}
                  onChange={(event) =>
                    setEdits((current) => ({
                      ...current,
                      [selectedDay.date]: { open: hours.open, close: event.target.value },
                    }))
                  }
                />
              </label>
            </>
          )}
          <label>
            <input
              type="checkbox"
              checked={'closed' in hours}
              onChange={(event) =>
                setEdits((current) => ({
                  ...current,
                  [selectedDay.date]: event.target.checked ? { closed: true } : { open: '09:00', close: '18:00' },
                }))
              }
            />
            Dicht
          </label>
        </div>
      ) : null}
      <div className="admin-slots">
        {selectedDay
          ? times.map((time) => {
              const held = booked(selectedDay.date, time, schedule)
              const shut = blocked(selectedDay.date, time, schedule)
              return (
                <button
                  key={time}
                  type="button"
                  disabled={held}
                  aria-pressed={shut}
                  onClick={() => {
                    void toggle(selectedDay.date, time, !shut)
                  }}
                >
                  {time}
                </button>
              )
            })
          : null}
      </div>
      {notice ? <p role="alert">{notice}</p> : null}
      <button type="button" className="admin-primary" disabled={!ready} onClick={() => { void apply() }}>
        Toepassen op komende weken
      </button>
    </div>
  )
}
