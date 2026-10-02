import mapboxgl from 'mapbox-gl'
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

function isMapOrStyleFailure(event: MapErrorEvent, map: mapboxgl.Map) {
  if (event.tile != null || event.sourceId != null) return false
  const message = event.error?.message ?? ''
  const url = event.error?.url ?? ''
  if (styleLoadFailure.test(message)) return true
  if (/mapbox:\/\/styles|\/styles\/v\d+\//.test(url) && !/\/tiles\//.test(url)) return true
  try {
    const style: unknown = map.getStyle()
    return style == null
  } catch (error) {
    const text = error instanceof Error ? error.message : ''
    return /no style|missing style/i.test(text)
  }
}

export function MapPanel() {
  const { lang } = useLang()
  const node = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(!token)

  useEffect(() => {
    if (!token || !node.current) return
    mapboxgl.accessToken = token
    let map: mapboxgl.Map
    try {
      map = new mapboxgl.Map({
        container: node.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [FALLBACK_PIN.lng, FALLBACK_PIN.lat],
        zoom: 15,
        cooperativeGestures: true,
      })
    } catch {
      setFailed(true)
      return
    }
    let removed = false
    const removeMap = () => {
      if (removed) return
      removed = true
      map.remove()
    }
    const marker = document.createElement('div')
    marker.style.width = '14px'
    marker.style.height = '14px'
    marker.style.background = '#f5c400'
    marker.style.clipPath = 'polygon(50% 0, 100% 100%, 0 100%)'
    new mapboxgl.Marker({ element: marker }).setLngLat([FALLBACK_PIN.lng, FALLBACK_PIN.lat]).addTo(map)
    map.on('load', () => {
      map.setLanguage(lang)
    })
    map.on('error', (event) => {
      if (removed || !isMapOrStyleFailure(event as MapErrorEvent, map)) return
      removeMap()
      setFailed(true)
    })
    return () => removeMap()
  }, [lang])

  if (failed) return <p className="map-fallback">{CONTACT.addressFull}</p>
  return <div ref={node} className="map-canvas" />
}
