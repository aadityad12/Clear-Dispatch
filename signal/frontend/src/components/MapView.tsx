import { useEffect, useRef, useMemo } from 'react'
import L from 'leaflet'
import { Call } from '../types'

interface Props {
  calls: Call[]
}

interface ApiState {
  fire_perimeter?: GeoJSON.GeoJsonObject
  resources?: Array<{ id: string; lat: number; lng: number; available: boolean }>
}

const TOTAL_UNITS = 10

export default function MapView({ calls }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersRef = useRef<{
    fire?: L.GeoJSON
    unitMarkers: L.CircleMarker[]
    availCount: number
  }>({ unitMarkers: [], availCount: TOTAL_UNITS })

  useEffect(() => {
    if (!elRef.current || mapRef.current) return

    const map = L.map(elRef.current, { zoomControl: false, attributionControl: false })
      .setView([39.85, -121.62], 9)

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      subdomains: 'abcd',
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapRef.current = map

    fetch('/api/state')
      .then((r) => r.json())
      .then((data: ApiState) => {
        if (!mapRef.current) return

        if (data.fire_perimeter) {
          layersRef.current.fire = L.geoJSON(data.fire_perimeter, {
            style: { color: '#ea580c', weight: 2, fillColor: '#fed7aa', fillOpacity: 0.35 },
          })
            .bindTooltip('Park Fire 2024 — 429,083 acres', { sticky: true })
            .addTo(mapRef.current)
        }

        if (data.resources) {
          layersRef.current.availCount = data.resources.filter((u) => u.available).length
          layersRef.current.unitMarkers = data.resources.map((unit) =>
            L.circleMarker([unit.lat, unit.lng], {
              radius: 6,
              color: unit.available ? '#16a34a' : '#475569',
              fillColor: unit.available ? '#22c55e' : '#64748b',
              fillOpacity: unit.available ? 0.95 : 0.7,
              weight: 2,
            })
              .bindTooltip(`Unit ${unit.id} — ${unit.available ? 'Available' : 'Unavailable'}`, { sticky: true })
              .addTo(mapRef.current!)
          )
        }
      })
      .catch(() => {/* backend not running yet */})

    return () => { map.remove(); mapRef.current = null }
  }, [])

  const stats = useMemo(() => ({
    avail: layersRef.current.availCount,
    total: TOTAL_UNITS,
    calls: calls.length,
  }), [calls.length])

  return (
    <div className="panel">
      <div className="panel-title">
        <span>Incident Map · Butte County</span>
        <span className="count mono">39.85°N 121.62°W</span>
      </div>
      <div className="map-wrap">
        <div id="map" ref={elRef} />
        <div className="map-stat">
          <div>UNITS <span className="v">{stats.avail}/{stats.total}</span></div>
          <div>CALLS <span className="v">{stats.calls}</span></div>
          <div>FIRE <span className="v" style={{ color: '#fb923c' }}>429,083 ac</span></div>
        </div>
        <div className="map-legend" aria-hidden>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: '#22c55e' }} />
            Available unit
          </div>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: '#64748b' }} />
            Unavailable
          </div>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: '#dc2626' }} />
            Active incident
          </div>
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: '#fed7aa', borderRadius: 2 }} />
            Fire perimeter
          </div>
        </div>
      </div>
    </div>
  )
}
