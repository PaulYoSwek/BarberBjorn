import { useMemo, useState } from 'react'
import { copy, type ServiceId } from '../../content'
import {
  bookingMoney,
  byMonth,
  byYear,
  formatMoney,
  inPeriod,
  periodLabel,
  reportCsv,
  settled,
  summarize,
  VAT_PRODUCTS,
  VAT_SERVICES,
  type Billable,
  type Period,
  type Summary,
} from '../../finance'
import type { InboxRow } from '../../planning-api'
import { serviceName } from './admin-defaults'

type Props = { rows: InboxRow[]; prices: Partial<Record<ServiceId, string>> }

/** Every service name by id, including ones Bjorn added or hid. */
function serviceNames(rows: { service: ServiceId }[]): Record<ServiceId, string> {
  const names: Record<ServiceId, string> = {}
  for (const row of rows) names[row.service] = serviceName(row.service)
  return names
}

function monthLabel(month: string): string {
  return `${copy.nl.months[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
}

function thisMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function download(name: string, text: string) {
  // The byte-order mark makes Excel read the € sign and accents correctly.
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** "yyyy-mm" shifted by a number of months. */
function shiftMonth(month: string, delta: number): string {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** Change against the month before, as "+12%" / "−8%"; nothing when there is no base. */
function changeLabel(current: number, previous: number): string | null {
  if (previous <= 0) return null
  const change = Math.round(((current - previous) / previous) * 100)
  if (change === 0) return 'gelijk aan vorige maand'
  return `${change > 0 ? '+' : '−'}${Math.abs(change)}% t.o.v. vorige maand`
}

type MonthPoint = { month: string; total: number; appointments: number }

/**
 * Revenue per month for the six months up to `until`, as plain bars: one
 * series in ink, the month in view in yellow, the value on each bar.
 */
function MonthChart({ points, focus }: { points: MonthPoint[]; focus: string | null }) {
  const width = 600
  const height = 150
  const top = 26
  const bottom = 26
  const gap = 10
  const slot = width / points.length
  const bar = slot - gap
  const max = Math.max(1, ...points.map((point) => point.total))
  const scale = (height - top - bottom) / max
  const title = points.map((point) => `${copy.nl.monthShort[Number(point.month.slice(5, 7)) - 1]} ${formatMoney(point.total)}`).join(', ')
  return (
    <figure className="finance-chart">
      <figcaption>Omzet per maand</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Omzet per maand: ${title}`}>
        <line x1="0" y1={height - bottom + 0.5} x2={width} y2={height - bottom + 0.5} className="finance-chart-axis" />
        {points.map((point, index) => {
          const h = point.total * scale
          const x = index * slot + gap / 2
          const y = height - bottom - h
          const label = copy.nl.monthShort[Number(point.month.slice(5, 7)) - 1]
          const on = point.month === focus
          return (
            <g key={point.month} className={on ? 'is-on' : undefined}>
              <title>{`${label} ${point.month.slice(0, 4)}: ${formatMoney(point.total)} · ${point.appointments} ${point.appointments === 1 ? 'afspraak' : 'afspraken'}`}</title>
              <rect x={x} y={height - bottom - Math.max(h, 2)} width={bar} height={Math.max(h, 2)} className="finance-chart-bar" />
              {point.total > 0 ? (
                <text x={x + bar / 2} y={y - 7} textAnchor="middle" className="finance-chart-value">
                  {formatMoney(point.total)}
                </text>
              ) : null}
              <text x={x + bar / 2} y={height - 8} textAnchor="middle" className="finance-chart-month">
                {label}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

function SummaryTiles({ summary, change }: { summary: Summary; change: string | null }) {
  return (
    <dl className="admin-stats finance-tiles">
      <div className="is-total">
        <dt>Omzet</dt>
        <dd>{formatMoney(summary.total)}</dd>
        {change ? <p className="finance-change">{change}</p> : null}
      </div>
      <div>
        <dt>Diensten</dt>
        <dd>{formatMoney(summary.services)}</dd>
      </div>
      <div>
        <dt>Producten</dt>
        <dd>{formatMoney(summary.products)}</dd>
      </div>
      <div>
        <dt>Korting gegeven</dt>
        <dd>{formatMoney(summary.discount)}</dd>
      </div>
      <div>
        <dt>Afspraken</dt>
        <dd>{summary.appointments}</dd>
      </div>
      <div>
        <dt>Gemiddeld per afspraak</dt>
        <dd>{formatMoney(summary.average)}</dd>
      </div>
    </dl>
  )
}

export function AdminFinance({ rows, prices }: Props) {
  const [kind, setKind] = useState<Period['kind']>('month')
  const [month, setMonth] = useState(thisMonth())
  const [year, setYear] = useState(thisMonth().slice(0, 4))

  const income = useMemo(() => settled(rows), [rows])
  const period = useMemo<Period>(
    () => (kind === 'month' ? { kind, month } : kind === 'year' ? { kind, year } : { kind }),
    [kind, month, year],
  )
  const inRange = useMemo(() => income.filter((row) => inPeriod(row.start, period)), [income, period])
  const summary = useMemo(() => summarize(inRange, prices), [inRange, prices])
  const upcoming = useMemo(
    () => summarize(rows.filter((row) => row.status === 'confirmed' && !income.includes(row)), prices),
    [rows, income, prices],
  )

  const months = useMemo(() => {
    const seen = new Set(income.map((row) => row.start.slice(0, 7)))
    seen.add(thisMonth())
    return [...seen].sort().reverse()
  }, [income])
  const years = useMemo(() => {
    const seen = new Set(income.map((row) => row.start.slice(0, 4)))
    seen.add(thisMonth().slice(0, 4))
    return [...seen].sort().reverse()
  }, [income])

  const label = periodLabel(period, copy.nl.months)
  // Six months of context, ending at the month in view (or this month).
  const chartEnd = kind === 'month' ? month : thisMonth()
  const perMonth = useMemo(() => new Map(byMonth(income, prices).map((item) => [item.month, item.summary])), [income, prices])
  const points: MonthPoint[] = Array.from({ length: 6 }, (_, index) => {
    const key = shiftMonth(chartEnd, index - 5)
    const found = perMonth.get(key)
    return { month: key, total: found?.total ?? 0, appointments: found?.appointments ?? 0 }
  })
  const change = kind === 'month' ? changeLabel(summary.total, perMonth.get(shiftMonth(month, -1))?.total ?? 0) : null
  const rowsNewestFirst = inRange.slice().sort((a, b) => b.start.localeCompare(a.start))
  const printedOn = new Date().toISOString().slice(0, 10)

  function exportCsv() {
    const slug = period.kind === 'all' ? 'alles' : period.kind === 'year' ? period.year : period.month
    download(`omzet-bjorns-barber-${slug}.csv`, reportCsv(inRange as Billable[], prices, serviceNames(inRange)))
  }

  return (
    <div className="admin-finance">
      <header className="admin-agenda-head">
        <div>
          <p className="admin-kicker">Omzet</p>
          <h1>Financiën</h1>
        </div>
      </header>

      <section className="finance-controls" aria-label="Periode">
        <div className="finance-kinds" role="tablist" aria-label="Soort periode">
          {(
            [
              ['month', 'Maand'],
              ['year', 'Jaar'],
              ['all', 'Alles'],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={kind === value}
              className={kind === value ? 'is-on' : undefined}
              onClick={() => setKind(value)}
            >
              {text}
            </button>
          ))}
        </div>
        {kind === 'month' ? (
          <label>
            Maand
            <select value={month} onChange={(event) => setMonth(event.target.value)}>
              {months.map((item) => (
                <option key={item} value={item}>
                  {monthLabel(item)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {kind === 'year' ? (
          <label>
            Jaar
            <select value={year} onChange={(event) => setYear(event.target.value)}>
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="finance-export">
          <button type="button" className="admin-add" onClick={exportCsv} disabled={inRange.length === 0}>
            Download CSV voor de boekhouder
          </button>
          <button type="button" onClick={() => window.print()} disabled={inRange.length === 0}>
            Rapport afdrukken of als PDF
          </button>
        </div>
        <p className="admin-hint">
          Telt bevestigde afspraken die al zijn geweest. Prijzen zijn inclusief btw ({VAT_SERVICES}% op knippen en
          baard, {VAT_PRODUCTS}% op producten).
        </p>
      </section>

      <section className="finance-report" aria-label={`Omzetrapport ${label}`}>
        <div className="finance-report-head">
          <p className="admin-kicker">Omzetrapport Bjorn’s Barber</p>
          <h2>{label}</h2>
          <p className="finance-report-meta">
            Ferdinandstraat 21, 4571 AN Axel · opgesteld op {printedOn} · bedragen in euro, inclusief btw
          </p>
        </div>

        <SummaryTiles summary={summary} change={change} />
        <MonthChart points={points} focus={kind === 'month' ? month : null} />

        <div className="finance-scroll"><table className="finance-table is-vat">
          <caption>Btw in de omzet</caption>
          <tbody>
            <tr>
              <th scope="row">Diensten ({VAT_SERVICES}%)</th>
              <td>{formatMoney(summary.services)}</td>
              <td>waarvan btw {formatMoney(summary.vatServices)}</td>
            </tr>
            <tr>
              <th scope="row">Producten ({VAT_PRODUCTS}%)</th>
              <td>{formatMoney(summary.products)}</td>
              <td>waarvan btw {formatMoney(summary.vatProducts)}</td>
            </tr>
            <tr className="is-total">
              <th scope="row">Totaal</th>
              <td>{formatMoney(summary.total)}</td>
              <td>waarvan btw {formatMoney(summary.vatServices + summary.vatProducts)}</td>
            </tr>
          </tbody>
        </table></div>

        {kind !== 'month' ? (
          <div className="finance-scroll"><table className="finance-table">
            <caption>{kind === 'year' ? 'Per maand' : 'Per jaar en per maand'}</caption>
            <thead>
              <tr>
                <th>Periode</th>
                <th>Afspraken</th>
                <th>Diensten</th>
                <th>Producten</th>
                <th>Korting</th>
                <th>Omzet</th>
              </tr>
            </thead>
            <tbody>
              {(kind === 'all' ? byYear(inRange, prices).map((item) => ({ key: item.year, label: item.year, summary: item.summary, strong: true })) : [])
                .concat(byMonth(inRange, prices).map((item) => ({ key: item.month, label: monthLabel(item.month), summary: item.summary, strong: false })))
                .sort((a, b) => b.key.localeCompare(a.key))
                .map((item) => (
                  <tr key={item.key} className={item.strong ? 'is-total' : undefined}>
                    <th scope="row">{item.label}</th>
                    <td>{item.summary.appointments}</td>
                    <td>{formatMoney(item.summary.services)}</td>
                    <td>{formatMoney(item.summary.products)}</td>
                    <td>{formatMoney(item.summary.discount)}</td>
                    <td>{formatMoney(item.summary.total)}</td>
                  </tr>
                ))}
            </tbody>
          </table></div>
        ) : null}

        <div className="finance-scroll"><table className="finance-table">
          <caption>{kind === 'month' ? 'Alle afspraken' : 'Afspraken'}</caption>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Klant</th>
              <th>Dienst</th>
              <th>Producten</th>
              <th>Korting</th>
              <th>Totaal</th>
            </tr>
          </thead>
          <tbody>
            {rowsNewestFirst.length === 0 ? (
              <tr>
                <td colSpan={6} className="finance-empty">
                  Geen afspraken in deze periode.
                </td>
              </tr>
            ) : null}
            {rowsNewestFirst.map((row) => {
              const money = bookingMoney(row, prices)
              return (
                <tr key={row.id}>
                  <td>
                    {row.start.slice(0, 10)} {row.start.slice(11, 16)}
                  </td>
                  <td>{row.name}</td>
                  <td>
                    {serviceName(row.service)} {formatMoney(money.servicePrice)}
                  </td>
                  <td>
                    {(row.items ?? []).length === 0
                      ? '—'
                      : (row.items ?? []).map((item) => `${item.quantity}× ${item.name} ${formatMoney(item.price * item.quantity)}`).join(', ')}
                  </td>
                  <td>{money.discount ? formatMoney(money.discount) : '—'}</td>
                  <td>{formatMoney(money.total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      </section>

      {upcoming.appointments > 0 ? (
        <p className="admin-hint finance-upcoming">
          Nog te komen: {upcoming.appointments} bevestigde {upcoming.appointments === 1 ? 'afspraak' : 'afspraken'} ter
          waarde van {formatMoney(upcoming.total)}. Die tellen pas mee als ze zijn geweest.
        </p>
      ) : null}
    </div>
  )
}
