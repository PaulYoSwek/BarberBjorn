import type { Map as MapboxMap } from 'mapbox-gl'
import { useEffect, useRef, useState } from 'react'
import { CONTACT } from '../content'
import { onFirstInteraction } from '../idle'
import { useLang } from '../language'
import { FALLBACK_PIN } from '../pin'

const token = import.meta.env.VITE_MAPBOX_TOKEN

type MapErrorEvent = {
  error: Error & { url?: string }
  tile?: unknown
  sourceId?: string
}

const styleLoadFailure = /style is not done loading|failed to load style|could not load style|missing style|no style added|there is no style/i
const styleNotLoaded = /Style is not done loading|no style|missing style/
const webglInitFailure = /Failed to initialize WebGL/
const spriteResource = /sprite@2x\.png|\/sprite/i
/** Style JSON, e.g. /styles/v1/mapbox/dark-v11 — not a sprite or tile subresource. */
const styleDocumentUrl = /\/styles\/v1\/[^/?#]+\/[^/?#]+\/?(?=[?#]|$)/

function isStyleDocumentUrl(value: string) {
  return styleDocumentUrl.test(value) && !spriteResource.test(value) && !/\/tiles\//.test(value)
}

function isSpriteOnlyError(url: string, message: string) {
  if (!spriteResource.test(url) && !spriteResource.test(message)) return false
  return !isStyleDocumentUrl(url) && !isStyleDocumentUrl(message)
}

function isMapOrStyleFailure(event: MapErrorEvent, map: MapboxMap) {
  if (event.tile != null || event.sourceId != null) return false
  const message = event.error?.message ?? ''
  const url = event.error?.url ?? ''
  if (isSpriteOnlyError(url, message)) return false
  if (webglInitFailure.test(message)) return true
  if (isStyleDocumentUrl(url) || isStyleDocumentUrl(message)) return true
  if (/mapbox:\/\/styles/.test(url) || /mapbox:\/\/styles/.test(message)) return true
  if (styleLoadFailure.test(message)) return true
  try {
    const style: unknown = map.getStyle()
    return style == null
  } catch (error) {
    const text = error instanceof Error ? error.message : ''
    return styleNotLoaded.test(text)
  }
}

const PIN_SVG =
  '<svg viewBox="0 0 28 38" aria-hidden="true"><path fill="#f5c400" stroke="#101010" stroke-width="1.6" d="M14 36.5 3.2 16.2A11.2 11.2 0 1 1 24.8 16.2Z"/><circle cx="14" cy="14" r="4.2" fill="#101010"/></svg>'

const STYLE = 'mapbox/dark-v11'
const ZOOM = 15

/** A still of the map around the shop from Mapbox, sized to the panel. */
export function staticMapUrl(width: number, height: number, accessToken = token): string {
  const w = Math.max(100, Math.min(1280, Math.round(width)))
  const h = Math.max(100, Math.min(1280, Math.round(height)))
  const at = `${FALLBACK_PIN.lng},${FALLBACK_PIN.lat}`
  return `https://api.mapbox.com/styles/v1/${STYLE}/static/pin-l+f5c400(${at})/${at},${ZOOM},0/${w}x${h}@2x?access_token=${accessToken}`
}

/** Phones get a still and load the live map on a tap; wider screens load it on the first movement. */
function liveMapWithoutAsking(): boolean {
  return !window.matchMedia('(max-width: 800px), (pointer: coarse)').matches
}

/**
 * The map library is half a megabyte. On phones the panel shows a still of the
 * map and loads the live map when it is tapped; on wider screens the live map
 * comes on the visitor's first movement, so it never delays what they see first.
 * Without a token, or when the map fails, the address stays as text.
 */
export function MapPanel() {
  const { t, lang } = useLang()
  const wrap = useRef<HTMLDivElement>(null)
  const node = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const [failed, setFailed] = useState(!token)
  const [loaded, setLoaded] = useState(false)
  const [live, setLive] = useState(false)
  const [still, setStill] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    if (!token || !wrap.current) return
    if (liveMapWithoutAsking()) return onFirstInteraction(() => setLive(true))
    setStill({ w: wrap.current.clientWidth || 400, h: wrap.current.clientHeight || 340 })
  }, [])

  useEffect(() => {
    if (!token || !live || !node.current) return
    let cancelled = false
    let removed = false
    const removeMap = () => {
      if (removed) return
      removed = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    Promise.all([import('mapbox-gl'), import('mapbox-gl/dist/mapbox-gl.css')])
      .then(([module]) => {
        if (cancelled || !node.current) return
        const lib = module.default
        lib.accessToken = token
        let map: MapboxMap
        try {
          map = new lib.Map({
            container: node.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [FALLBACK_PIN.lng, FALLBACK_PIN.lat],
            zoom: 15,
            cooperativeGestures: true,
            attributionControl: false,
            // No performance measurements to Mapbox (see the privacy statement).
            performanceMetricsCollection: false,
          })
        } catch (error) {
          console.error('Map could not start', error)
          setFailed(true)
          return
        }
        mapRef.current = map
        const marker = document.createElement('div')
        marker.className = 'map-pin'
        marker.innerHTML = PIN_SVG
        new lib.Marker({ element: marker, anchor: 'bottom' }).setLngLat([FALLBACK_PIN.lng, FALLBACK_PIN.lat]).addTo(map)
        map.on('load', () => {
          if (removed) return
          setLoaded(true)
        })
        map.on('error', (event) => {
          if (removed || !isMapOrStyleFailure(event as MapErrorEvent, map)) return
          console.error('Map failed', (event as MapErrorEvent).error)
          removeMap()
          setFailed(true)
        })
      })
      .catch((error: unknown) => {
        console.error('Map library could not load', error)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      removeMap()
    }
  }, [live])

  useEffect(() => {
    if (!loaded) return
    try {
      mapRef.current?.setLanguage(lang)
    } catch {
      /* label language is a nicety */
    }
  }, [lang, loaded])

  if (failed) return <p className="map-fallback">{CONTACT.addressFull}</p>
  return (
    <div ref={wrap} className="map-canvas">
      <div ref={node} className="map-live" />
      {!loaded && still ? (
        <button type="button" className="map-still" aria-label={t.mapOpen} onClick={() => setLive(true)}>
          <img src={staticMapUrl(still.w, still.h)} alt="" width={still.w} height={still.h} decoding="async" />
        </button>
      ) : null}
    </div>
  )
}
