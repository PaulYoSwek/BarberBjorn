import mapboxgl from 'mapbox-gl'
import { useEffect, useRef, useState } from 'react'
import { CONTACT } from '../content'
import { useLang } from '../language'
import { FALLBACK_PIN } from '../pin'

const token = import.meta.env.VITE_MAPBOX_TOKEN

export function MapPanel() {
  const { lang } = useLang()
  const node = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(!token)

  useEffect(() => {
    if (!token || !node.current) return
    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: node.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [FALLBACK_PIN.lng, FALLBACK_PIN.lat],
      zoom: 15,
      cooperativeGestures: true,
    })
    const marker = document.createElement('div')
    marker.style.width = '14px'
    marker.style.height = '14px'
    marker.style.background = '#f5c400'
    marker.style.clipPath = 'polygon(50% 0, 100% 100%, 0 100%)'
    new mapboxgl.Marker({ element: marker }).setLngLat([FALLBACK_PIN.lng, FALLBACK_PIN.lat]).addTo(map)
    map.on('load', () => {
      map.setLanguage(lang)
    })
    map.on('error', () => setFailed(true))
    return () => map.remove()
  }, [lang])

  if (failed) return <p className="map-fallback">{CONTACT.addressFull}</p>
  return <div ref={node} className="map-canvas" />
}
