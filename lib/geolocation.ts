export const CHECKIN_CENTER = { lat: -7.041736, lng: 113.558258 }
// Radius default; Super Admin bisa menggantinya lewat Pengaturan (SystemSetting CHECKIN_RADIUS_METERS).
export const CHECKIN_RADIUS_METERS = 10
export const CHECKIN_RADIUS_MIN_M = 5
export const CHECKIN_RADIUS_MAX_M = 1000
export const CHECKIN_RADIUS_SETTING_KEY = 'CHECKIN_RADIUS_METERS'
// GPS HP bisa meleset 5–50 m. Ketelitian yang dilaporkan HP ikut dihitung, tapi dibatasi
// supaya nilai ketelitian besar tidak melonggarkan radius tanpa batas.
export const CHECKIN_MAX_ACCURACY_ALLOWANCE_M = 30

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
  accuracyM = 0,
  radiusM = CHECKIN_RADIUS_METERS,
): { isWithinRadius: boolean; distanceM: number } {
  const distanceM = haversineDistance(lat, lng, CHECKIN_CENTER.lat, CHECKIN_CENTER.lng)
  const allowance = Math.min(Math.max(accuracyM, 0), CHECKIN_MAX_ACCURACY_ALLOWANCE_M)
  return { isWithinRadius: distanceM - allowance <= radiusM, distanceM }
}

export function isValidCheckInRadius(value: string | null | undefined): boolean {
  if (value == null || value.trim() === '') return false
  const n = Number(value)
  return Number.isInteger(n) && n >= CHECKIN_RADIUS_MIN_M && n <= CHECKIN_RADIUS_MAX_M
}

// Nilai tersimpan yang kosong, rusak, atau di luar batas → pakai default.
export function parseCheckInRadius(value: string | null | undefined): number {
  return isValidCheckInRadius(value) ? Number(value) : CHECKIN_RADIUS_METERS
}

export function getTodayWIB(): string {
  const wibOffset = 7 * 60 * 60 * 1000
  const wibDate = new Date(Date.now() + wibOffset)
  return wibDate.toISOString().slice(0, 10)
}
