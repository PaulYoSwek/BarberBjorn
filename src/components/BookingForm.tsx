import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { mailtoHref, todayIso, validateBooking, type BookingInput } from '../booking'
import { CONTACT } from '../content'
import { useLang } from '../language'
import { agendaDays, SERVICE_MINUTES, type AgendaDay } from '../schedule'

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

export function BookingForm() {
  const { t } = useLang()
  const [input, setInput] = useState<BookingInput>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof BookingInput, string>>>({})
  const [fallback, setFallback] = useState('')
  const inputRef = useRef(input)
  inputRef.current = input
  const [week, setWeek] = useState(0)
  const days = useMemo(() => agendaDays(input.service, new Date()), [input.service])
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
    const next = { ...input, service, slot: '' }
    setInput(next)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const result = validateBooking(input, t, todayIso())
    if (!result.ok) {
      setErrors(result.errors)
      setFallback('')
      return
    }
    setErrors({})
    const href = mailtoHref(CONTACT.email, result.subject, result.body)
    setFallback(`${t.mailFallback}\n${CONTACT.email}\n${result.body}`)
    window.location.assign(href)
  }

  const duration = input.service ? SERVICE_MINUTES[input.service] : 0

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
        </div>
        {errors.slot && <span role="alert">{errors.slot}</span>}
        <div className="booking-fields">
          <label>
            {t.nameLabel}
            <input value={input.name} onChange={(event) => setInput({ ...input, name: event.target.value })} />
            {errors.name && <span role="alert">{errors.name}</span>}
          </label>
          <label>
            {t.phoneLabel}
            <input value={input.phone} inputMode="tel" onChange={(event) => setInput({ ...input, phone: event.target.value })} />
            {errors.phone && <span role="alert">{errors.phone}</span>}
          </label>
          <button type="submit">{t.sendLabel}</button>
        </div>
        {fallback && <p role="alert">{fallback}</p>}
      </form>
    </section>
  )
}
