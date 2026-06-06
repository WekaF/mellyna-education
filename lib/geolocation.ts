export const CHECKIN_CENTER = { lat: -7.041736, lng: 113.558258 }
export const CHECKIN_RADIUS_METERS = 500

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function checkRadius(
  lat: number,
  lng: number,
): { isWithinRadius: boolean; distanceM: number } {
  const distanceM = haversineDistance(lat, lng, CHECKIN_CENTER.lat, CHECKIN_CENTER.lng)
  return { isWithinRadius: distanceM <= CHECKIN_RADIUS_METERS, distanceM }
}

export function getTodayWIB(): string {
  const wibOffset = 7 * 60 * 60 * 1000
  const wibDate = new Date(Date.now() + wibOffset)
  return wibDate.toISOString().slice(0, 10)
}
