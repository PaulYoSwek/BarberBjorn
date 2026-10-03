import { useEffect, useRef, useState, type CSSProperties } from 'react'

type Tone = 'ink' | 'paper' | 'warm' | 'about'
export type RopeEdge = { of: 'prev' | 'next'; left: number; right: number }

function isNarrow() {
  return window.innerWidth <= 800
}

function edgeYs(edge: RopeEdge, h: number, narrow: boolean) {
  if (narrow && edge.of === 'prev') return { y0: h, y1: h - 40 }
  if (narrow && edge.of === 'next') return { y0: 108, y1: 28 }
  return { y0: edge.left * h, y1: edge.right * h }
}

function edgeStyle(band: HTMLElement, edge: RopeEdge): CSSProperties {
  const target = (edge.of === 'prev' ? band.previousElementSibling : band.nextElementSibling) as HTMLElement | null
  if (!target) return {}
  const w = target.clientWidth
  const h = target.clientHeight
  const { y0, y1 } = edgeYs(edge, h, isNarrow())
  const dy = y1 - y0
  const len = Math.hypot(w, dy) + 26
  const angle = Math.atan2(dy, w) * (180 / Math.PI)
  const midX = w / 2
  const midY = (y0 + y1) / 2
  const here = band.getBoundingClientRect()
  const box = target.getBoundingClientRect()
  return {
    left: box.left - here.left + midX,
    top: box.top - here.top + midY,
    width: len,
    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
  }
}

export function RopeDivider({ tone, edge }: { tone: Tone; edge?: RopeEdge }) {
  const band = useRef<HTMLDivElement>(null)
  const [cut, setCut] = useState<CSSProperties>({})

  useEffect(() => {
    if (!edge) return
    const el = band.current
    if (!el) return
    const fit = () => setCut(edgeStyle(el, edge))
    fit()
    window.addEventListener('resize', fit)
    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', fit)
    }
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    const other = edge.of === 'prev' ? el.previousElementSibling : el.nextElementSibling
    if (other) watch.observe(other)
    return () => {
      window.removeEventListener('resize', fit)
      watch.disconnect()
    }
  }, [edge])

  return (
    <div
      ref={band}
      className={`rope-band is-${tone}${edge ? ' is-cut' : ''}`}
      aria-hidden="true"
    >
      <img src="/rope-divider.png?v=16" alt="" style={edge ? cut : undefined} />
    </div>
  )
}
