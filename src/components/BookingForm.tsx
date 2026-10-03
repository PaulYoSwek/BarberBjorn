import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { todayIso, validateBooking, type BookingInput } from '../booking'
import type { ServiceId } from '../content'
import { useLang } from '../language'
import { loadPublicSchedule, loadServices, submitBook, submitCustom } from '../planning-api'
import { agendaDays, defaultSchedule, SERVICE_MINUTES, type AgendaDay, type Schedule } from '../schedule'

const empty: BookingInput = { service: '', name: '', email: '', phone: '', slot: '', kind: 'slot' }
const WEEK = 7

function monthIndex(date: string) {
  return Number(date.slice(5, 7)) - 1
}

function dayStamp(day: AgendaDay, labels: { key: string; label: string }[], short: string[]) {
  const name = labels.find((item) => item.key === day.weekday)?.label ?? day.weekday
  return `${name} ${Number(day.date.slice(8, 10))} ${short[monthIndex(day.date)]}`
}

function monthTitle(visible: AgendaDay[], months: string[]) {
  const first = monthIndex(visible[0].date)
  const last = monthIndex(visible[visible.length - 1].date)
  const year = visible[0].date.slice(0, 4)
  const yearEnd = visible[visible.length - 1].date.slice(0, 4)
  if (first === last && year === yearEnd) return `${months[first]} ${year}`
  if (year === yearEnd) return `${months[first]} – ${months[last]} ${year}`
  return `${months[first]} ${year} – ${months[last]} ${yearEnd}`
}

function customSlot(date: string, time: string) {
  if (!date || !time) return ''
  return `${date}T${time.slice(0, 5)}:00`
}

export function BookingForm() {
  const { t, lang } = useLang()
  const [input, setInput] = useState<BookingInput>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof BookingInput, string>>>({})
  const [status, setStatus] = useState<'book' | 'request' | ''>('')
  const [submitError, setSubmitError] = useState('')
  const [schedule, setSchedule] = useState<Schedule>(defaultSchedule)
  const [minutes, setMinutes] = useState<Record<ServiceId, number> | null>(null)
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('')
  const inputRef = useRef(input)
  inputRef.current = input
  const [week, setWeek] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadPublicSchedule()
      .then((next) => {
        if (!cancelled) setSchedule(next)
      })
      .catch(() => {})
    loadServices()
      .then((rows) => {
        if (cancelled || rows.length === 0) return
        const next = { ...SERVICE_MINUTES }
        for (const row of rows) next[row.id] = row.minutes
        setMinutes(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const days = useMemo(
    () =>
      agendaDays(input.service, new Date(), {
        week: schedule.week,
        exceptions: schedule.exceptions,
        blocks: schedule.blocks,
        bookings: schedule.bookings,
        ...(minutes ? { minutes } : {}),
      }),
    [input.service, schedule, minutes],
  )
  const visible = days.slice(week * WEEK, week * WEEK + WEEK)
  const lastWeek = Math.ceil(days.length / WEEK) - 1

  useEffect(() => {
    setErrors((current) => {
      if (Object.keys(current).length === 0) return current
      const result = validateBooking(inputRef.current, t, todayIso())
      if (result.ok) return current
      return result.errors
    })
  }, [t])

  const setService = (service: BookingInput['service']) => {
    setInput({ ...input, service, slot: input.kind === 'slot' ? '' : input.slot })
  }

  const chooseCustom = () => {
    setCustomDate('')
    setCustomTime('')
    setInput({ ...input, kind: 'custom', slot: '' })
  }

  const setCustom = (date: string, time: string) => {
    setCustomDate(date)
    setCustomTime(time)
    setInput({ ...input, kind: 'custom', slot: customSlot(date, time) })
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const result = validateBooking(input, t, todayIso())
    if (!result.ok) {
      setErrors(result.errors)
      setStatus('')
      setSubmitError('')
      return
    }
    setErrors({})
    const payload = { ...input, lang }
    const sent = input.kind === 'custom' ? await submitCustom(payload) : await submitBook(payload)
    if (!sent.ok) {
      setStatus('')
      setSubmitError(sent.error)
      return
    }
    setSubmitError('')
    setStatus(input.kind === 'custom' ? 'request' : 'book')
  }

  const duration = input.service ? (minutes?.[input.service] ?? SERVICE_MINUTES[input.service]) : 0

  return (
    <section id="afspraak" className="booking">
      <form onSubmit={onSubmit}>
        <div className="booking-top">
          <div>
            <p className="kicker">{t.bookKicker}</p>
            <h2>{t.bookTitle}</h2>
            <p>{t.bookIntro}</p>
          </div>
          <label>
            {t.serviceLabel}
            {duration > 0 ? ` · ${duration} min` : ''}
            <select
              value={input.service}
              onChange={(event) => setService(event.target.value as BookingInput['service'])}
            >
              <option value="">{t.serviceLabel}</option>
              {t.services.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            {errors.service && <span role="alert">{errors.service}</span>}
          </label>
        </div>
        <div className="agenda-wrap">
          {input.kind === 'custom' ? (
            <div className="booking-fields">
              <h3>{t.customTimeTitle}</h3>
              <label>
                {t.dayLabel}
                <input
                  type="date"
                  value={customDate}
                  onChange={(event) => setCustom(event.target.value, customTime)}
                />
              </label>
              <label>
                {t.slotLabel}
                <input
                  type="time"
                  value={customTime}
                  onChange={(event) => setCustom(customDate, event.target.value)}
                />
              </label>
            </div>
          ) : (
            <>
              <div className="agenda-head">
                <h3 className="agenda-month">{visible.length > 0 ? monthTitle(visible, t.months) : ''}</h3>
                <div className="agenda-week">
                  <button type="button" aria-label={t.weekPrev} disabled={week === 0} onClick={() => setWeek((current) => current - 1)}>
                    ←
                  </button>
                  <button type="button" aria-label={t.weekNext} disabled={week >= lastWeek} onClick={() => setWeek((current) => current + 1)}>
                    →
                  </button>
                </div>
              </div>
              <div className="agenda">
              {visible.map((day) => {
                const label = dayStamp(day, t.days, t.monthShort)
                return (
                  <div key={day.date} className={day.closed ? 'agenda-day is-closed' : 'agenda-day'}>
                    <div className="agenda-when">
                      <strong>{label}</strong>
                      {day.closed && <span>{t.closedLabel}</span>}
                    </div>
                    {!day.closed && (
                      <div className="agenda-slots">
                        {day.slots.map((slot) => {
                          const blocked = slot.taken || slot.past
                          const on = input.slot === slot.start
                          return (
                            <button
                              key={slot.start}
                              type="button"
                              aria-label={`${label} ${slot.time}`}
                              aria-pressed={on}
                              disabled={blocked}
                              className={on ? 'is-on' : undefined}
                              onClick={() => setInput({ ...input, slot: slot.start })}
                            >
                              {slot.time}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              </div>
              <div className="agenda-week">
                <button type="button" onClick={chooseCustom}>{t.customTimeCta}</button>
              </div>
            </>
          )}
          {errors.slot && <span role="alert">{errors.slot}</span>}
        </div>
        <div className="booking-fields">
          <label>
            {t.nameLabel}
            <input value={input.name} autoComplete="name" onChange={(event) => setInput({ ...input, name: event.target.value })} />
            {errors.name && <span role="alert">{errors.name}</span>}
          </label>
          <label>
            {t.emailLabel}
            <input type="email" value={input.email} autoComplete="email" onChange={(event) => setInput({ ...input, email: event.target.value })} />
            {errors.email && <span role="alert">{errors.email}</span>}
          </label>
          <label>
            {t.phoneOptional}
            <input value={input.phone} type="tel" inputMode="tel" autoComplete="tel" onChange={(event) => setInput({ ...input, phone: event.target.value })} />
            {errors.phone && <span role="alert">{errors.phone}</span>}
          </label>
          <button type="submit">{t.sendLabel}</button>
        </div>
        {status === 'book' && <p>{t.bookSuccess}</p>}
        {status === 'request' && <p>{t.requestSuccess}</p>}
        {submitError && <p role="alert">{submitError}</p>}
      </form>
    </section>
  )
}
