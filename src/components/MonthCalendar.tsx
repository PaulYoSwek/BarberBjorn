import type { ReactNode } from 'react'
import { monthCells, type MonthCell } from '../schedule'

type Props = {
  year: number
  /** 0 = January. */
  month: number
  title: string
  weekdayLabels: string[]
  prevLabel: string
  nextLabel: string
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  renderDay: (cell: MonthCell) => ReactNode
  className?: string
}

/** A month as a Monday-first grid; what each day shows is up to the caller. */
export function MonthCalendar({
  year,
  month,
  title,
  weekdayLabels,
  prevLabel,
  nextLabel,
  canPrev,
  canNext,
  onPrev,
  onNext,
  renderDay,
  className,
}: Props) {
  const cells = monthCells(year, month)
  return (
    <div className={`cal${className ? ` ${className}` : ''}`}>
      <div className="cal-head">
        <h3 className="cal-title">{title}</h3>
        <div className="cal-nav">
          <button type="button" aria-label={prevLabel} disabled={!canPrev} onClick={onPrev}>
            ←
          </button>
          <button type="button" aria-label={nextLabel} disabled={!canNext} onClick={onNext}>
            →
          </button>
        </div>
      </div>
      <div className="cal-weekdays" aria-hidden="true">
        {weekdayLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="cal-grid" role="grid">
        {cells.map((cell) => (
          <div key={cell.date} role="gridcell" className={cell.inMonth ? undefined : 'cal-outside'}>
            {cell.inMonth ? renderDay(cell) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
