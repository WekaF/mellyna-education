'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

const POSITION: [number, number] = [-7.041736, 113.558241]

export default function LeafletMap() {
  useEffect(() => {
    // Fix default marker icon missing in Next.js builds
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    })
  }, [])

  return (
    <MapContainer
      center={POSITION}
      zoom={16}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%', minHeight: '420px', borderRadius: '1.5rem' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={POSITION}>
        <Popup>
          <div className="text-sm font-bold">Mellyna Education</div>
          <div className="text-xs text-slate-500 mt-0.5">Jawa Timur, Indonesia</div>
          <a
            href="https://maps.app.goo.gl/ZFnnCMCh7yo27j9m7"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 font-semibold mt-1 block"
          >
            Buka Google Maps →
          </a>
        </Popup>
      </Marker>
    </MapContainer>
  )
}
