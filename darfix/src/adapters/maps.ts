/**
 * Maps adapter — mock geocoding/pin; replace with Google Maps / Mapbox later.
 */
export interface GeoPoint {
  lat: number
  lng: number
  label?: string
}

export interface MapsService {
  geocode(address: string): Promise<GeoPoint>
  reverseGeocode(lat: number, lng: number): Promise<string>
  staticMapUrl(point: GeoPoint, zoom?: number): string
}

/** Rough centroids for demo cities */
const CITY_CENTROIDS: Record<string, GeoPoint> = {
  riyadh: { lat: 24.7136, lng: 46.6753, label: 'Riyadh' },
  jeddah: { lat: 21.4858, lng: 39.1925, label: 'Jeddah' },
  dammam: { lat: 26.4207, lng: 50.0888, label: 'Dammam' },
  khobar: { lat: 26.2172, lng: 50.1971, label: 'Al Khobar' },
}

export class MockMapsService implements MapsService {
  async geocode(address: string): Promise<GeoPoint> {
    const lower = address.toLowerCase()
    for (const [id, point] of Object.entries(CITY_CENTROIDS)) {
      if (lower.includes(id) || lower.includes(point.label!.toLowerCase())) {
        return {
          lat: point.lat + (Math.random() - 0.5) * 0.02,
          lng: point.lng + (Math.random() - 0.5) * 0.02,
          label: address,
        }
      }
    }
    return { lat: 24.7136, lng: 46.6753, label: address }
  }

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }

  staticMapUrl(point: GeoPoint, zoom = 14): string {
    // Placeholder SVG data URI — swap for real map tile API later
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#E6F0F3"/><stop offset="1" stop-color="#F0FDFA"/></linearGradient></defs>
      <rect width="600" height="300" fill="url(#g)"/>
      <circle cx="300" cy="150" r="18" fill="#14B8A6" opacity="0.3"/>
      <circle cx="300" cy="150" r="8" fill="#0B3A4A"/>
      <text x="300" y="260" text-anchor="middle" fill="#0B3A4A" font-family="sans-serif" font-size="14">${point.label ?? `${point.lat.toFixed(3)}, ${point.lng.toFixed(3)}`} · z${zoom}</text>
    </svg>`
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }

  cityCentroid(cityId: string): GeoPoint {
    return CITY_CENTROIDS[cityId] ?? CITY_CENTROIDS.riyadh
  }
}

export const mapsService: MapsService = new MockMapsService()
