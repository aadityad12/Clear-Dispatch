import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { Call } from '../types'

interface Props {
  calls: Call[]
}

interface ApiState {
  fire_perimeter?: GeoJSON.GeoJsonObject
  resources?: Array<{ id: string; lat: number; lng: number; available: boolean }>
}

export default function MapView({ calls: _calls }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mapRef.current) return

    const map = L.map(mapRef.current, { center: [38.54, -121.74], zoom: 9 })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)

    fetch('/api/state')
      .then((r) => r.json())
      .then((data: ApiState) => {
        if (data.fire_perimeter) {
          L.geoJSON(data.fire_perimeter, {
            style: {
              color: '#ea580c',
              weight: 2,
              fillColor: '#fed7aa',
              fillOpacity: 0.4,
            },
          })
            .bindTooltip('Park Fire 2024 — 429,083 acres')
            .addTo(map)
        }

        if (data.resources) {
          data.resources.forEach((unit) => {
            L.circleMarker([unit.lat, unit.lng], {
              radius: 6,
              color: unit.available ? '#16a34a' : '#94a3b8',
              fillColor: unit.available ? '#16a34a' : '#94a3b8',
              fillOpacity: 0.8,
              weight: 1,
            })
              .bindTooltip(`Unit ${unit.id} — ${unit.available ? 'Available' : 'Unavailable'}`)
              .addTo(map)
          })
        }
      })
      .catch(() => {
        // backend not running yet — map still renders with base tiles
      })

    return () => {
      map.remove()
    }
  }, [])

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <span className="font-semibold text-slate-900 text-sm">Incident Map</span>
      </div>
      <div ref={mapRef} style={{ height: '400px' }} />
    </div>
  )
}
