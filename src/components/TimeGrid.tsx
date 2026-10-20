import type { CSSProperties, ReactNode } from 'react'

export function minutesOf(stamp: string): number {
  const [hours, minutes] = stamp.split(':').map(Number)
  return hours * 60 + minutes
}

export function clock(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export type GridHours = { open: string; close: string }

export type GridColumn = {
  key: string
  header: ReactNode
  /** Opening hours; none means the day is closed. */
  hours?: GridHours
  /** Blocks placed in the column with `blockStyle`. */
  children?: ReactNode
  className?: string
}

/** The hours a set of columns covers, rounded out to whole hours; 09–18 when nothing is open. */
export function axisOf(columns: { hours?: GridHours }[]): { start: number; end: number } {
  const open = columns.flatMap((column) => (column.hours ? [minutesOf(column.hours.open)] : []))
  const close = columns.flatMap((column) => (column.hours ? [minutesOf(column.hours.close)] : []))
  if (open.length === 0) return { start: 9 * 60, end: 18 * 60 }
  return { start: Math.floor(Math.min(...open) / 60) * 60, end: Math.ceil(Math.max(...close) / 60) * 60 }
}

/** Where a block that starts at `time` and lasts `minutes` sits in its column. */
export function blockStyle(time: string, minutes: number, axisStart: number, pxPerHour: number): CSSProperties {
  return {
    top: ((minutesOf(time) - axisStart) / 60) * pxPerHour,
    height: (minutes / 60) * pxPerHour,
  }
}

type Props = {
  columns: GridColumn[]
  axisStart: number
  axisEnd: number
  pxPerHour: number
  closedLabel: string
  className?: string
}

/**
 * Days as columns, hours down the side, like a calendar app. Each column gets
 * its opening hours shaded out and whatever blocks the caller places in it.
 */
export function TimeGrid({ columns, axisStart, axisEnd, pxPerHour, closedLabel, className }: Props) {
  const hours: number[] = []
  for (let at = axisStart; at < axisEnd; at += 60) hours.push(at)
  const height = ((axisEnd - axisStart) / 60) * pxPerHour
  const vars = { '--tg-cols': columns.length, '--tg-hour': `${pxPerHour}px` } as CSSProperties
  return (
    <div className={`tg${className ? ` ${className}` : ''}`} style={vars}>
      <div className="tg-head">
        <div className="tg-corner" />
        {columns.map((column) => (
          <div key={column.key} className={`tg-head-cell${column.className ? ` ${column.className}` : ''}`}>
            {column.header}
          </div>
        ))}
      </div>
      <div className="tg-body" style={{ height }}>
        <div className="tg-axis" aria-hidden="true">
          {hours.map((at) => (
            <span key={at} style={{ top: ((at - axisStart) / 60) * pxPerHour }}>
              {clock(at)}
            </span>
          ))}
        </div>
        {columns.map((column) => (
          <div
            key={column.key}
            className={`tg-col${column.hours ? '' : ' is-closed'}${column.className ? ` ${column.className}` : ''}`}
          >
            {column.hours ? (
              <>
                {minutesOf(column.hours.open) > axisStart ? (
                  <div
                    className="tg-shade"
                    style={blockStyle(clock(axisStart), minutesOf(column.hours.open) - axisStart, axisStart, pxPerHour)}
                  />
                ) : null}
                {minutesOf(column.hours.close) < axisEnd ? (
                  <div
                    className="tg-shade"
                    style={blockStyle(column.hours.close, axisEnd - minutesOf(column.hours.close), axisStart, pxPerHour)}
                  />
                ) : null}
                {column.children}
              </>
            ) : (
              <div className="tg-closed">
                <span>{closedLabel}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
