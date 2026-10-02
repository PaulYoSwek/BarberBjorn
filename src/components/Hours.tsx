import { useLang } from '../language'

export function Hours() {
  const { t } = useLang()
  const [start, end] = t.hoursTime.split(' — ')
  return (
    <section className="hours">
      <p className="hours-time">
        {start} <span className="hours-dash">—</span> {end}
      </p>
      <div className="hours-row">
        {t.days.map((day) => (
          <div key={day.key} className={day.closed ? 'hours-day is-closed' : 'hours-day'}>
            <span>{day.label}</span>
            {day.closed && <span>{t.closedLabel}</span>}
          </div>
        ))}
      </div>
    </section>
  )
}
