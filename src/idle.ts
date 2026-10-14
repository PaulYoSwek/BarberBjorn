/**
 * Runs `work` once the page has finished loading and the browser has a quiet
 * moment, so heavy extras (the map library, the hero video) never delay what
 * the visitor sees first. Returns a function that cancels it.
 */
export function whenIdle(work: () => void, timeout = 2500): () => void {
  let cancelled = false
  let idleId: number | undefined
  let timerId: number | undefined
  const run = () => {
    if (cancelled) return
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => {
        if (!cancelled) work()
      }, { timeout })
    } else {
      timerId = window.setTimeout(() => {
        if (!cancelled) work()
      }, 200)
    }
  }
  if (document.readyState === 'complete') run()
  else window.addEventListener('load', run, { once: true })
  return () => {
    cancelled = true
    window.removeEventListener('load', run)
    if (idleId !== undefined) window.cancelIdleCallback?.(idleId)
    if (timerId !== undefined) window.clearTimeout(timerId)
  }
}

/** Visitors who asked for less motion or less data get stills instead of video. */
export function prefersStills(): boolean {
  if (typeof window === 'undefined') return true
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return connection?.saveData === true
}
