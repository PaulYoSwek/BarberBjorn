import type { Map as MapboxMap } from 'mapbox-gl'
import { useEffect, useRef, useState } from 'react'
import { CONTACT } from '../content'
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

/**
 * The map library is large, so it loads in its own chunk after the page is
 * interactive. Without a token, or when the map fails, the address stays as text.
 */
export function MapPanel() {
  const { lang } = useLang()
  const node = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const [failed, setFailed] = useState(!token)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!token || !node.current) return
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
          })
        } catch {
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
          removeMap()
          setFailed(true)
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      removeMap()
    }
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      mapRef.current?.setLanguage(lang)
    } catch {
      /* label language is a nicety */
    }
  }, [lang, loaded])

  if (failed) return <p className="map-fallback">{CONTACT.addressFull}</p>
  return <div ref={node} className="map-canvas" />
}
