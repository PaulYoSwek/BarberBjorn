/** Colours Bjorn can give a closed time, so the agenda shows at a glance why it is closed. */
export const BLOCK_COLORS = [
  { id: '', label: 'Zwart', hex: '#101010' },
  { id: 'blue', label: 'Blauw', hex: '#2f6fb5' },
  { id: 'green', label: 'Groen', hex: '#2e8b57' },
  { id: 'orange', label: 'Oranje', hex: '#d9731a' },
  { id: 'purple', label: 'Paars', hex: '#7b4fb5' },
  { id: 'red', label: 'Rood', hex: '#b5342f' },
] as const

export type BlockColor = (typeof BLOCK_COLORS)[number]['id']

export function isBlockColor(value: unknown): value is BlockColor {
  return typeof value === 'string' && BLOCK_COLORS.some((item) => item.id === value)
}

export function blockHex(color: string | undefined): string {
  return BLOCK_COLORS.find((item) => item.id === (color ?? ''))?.hex ?? BLOCK_COLORS[0].hex
}

/** Longest a reason may be; the server enforces the same limit. */
export const REASON_MAX = 80
