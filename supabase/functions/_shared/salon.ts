const SALON = 'Europe/Amsterdam'
const NAIVE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

type Wall = { year: number; month: number; day: number; hour: number; minute: number; second: number }

function pad(part: number): string {
  return String(part).padStart(2, '0')
}

function amsterdamParts(instant: Date): Wall {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: SALON,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = Object.fromEntries(
    fmt
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

function formatWall(wall: Wall): string {
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}`
}

function offsetMinutes(instant: Date): number {
  const wall = amsterdamParts(instant)
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
  return Math.round((wallAsUtc - instant.getTime()) / 60_000)
}

export function utcToSalonWall(value: string): string {
  if (NAIVE.test(value)) return value
  const instant = new Date(value)
  if (Number.isNaN(instant.getTime())) return value.slice(0, 19)
  return formatWall(amsterdamParts(instant))
}

export function salonWallToUtc(local: string): string {
  if (!NAIVE.test(local)) {
    const parsed = new Date(local)
    return Number.isNaN(parsed.getTime()) ? local : parsed.toISOString()
  }
  const [datePart, timePart] = local.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute, second] = timePart.split(':').map(Number)
  const wallUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  let utc = wallUtc
  for (let pass = 0; pass < 3; pass++) {
    utc = wallUtc - offsetMinutes(new Date(utc)) * 60_000
  }
  return new Date(utc).toISOString()
}

export function salonNow(): Date {
  const wall = amsterdamParts(new Date())
  return new Date(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
}
