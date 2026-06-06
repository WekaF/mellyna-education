import { haversineDistance, checkRadius, getTodayWIB, CHECKIN_CENTER, CHECKIN_RADIUS_METERS } from '@/lib/geolocation'

describe('haversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistance(-7.041736, 113.558258, -7.041736, 113.558258)).toBe(0)
  })

  it('calculates ~667m for 0.006 degree latitude difference', () => {
    const d = haversineDistance(-7.041736, 113.558258, -7.035736, 113.558258)
    expect(d).toBeGreaterThan(600)
    expect(d).toBeLessThan(750)
  })
})

describe('checkRadius', () => {
  it('center point is within radius', () => {
    const result = checkRadius(CHECKIN_CENTER.lat, CHECKIN_CENTER.lng)
    expect(result.isWithinRadius).toBe(true)
    expect(result.distanceM).toBe(0)
  })

  it('point ~111m away is within 500m radius', () => {
    const result = checkRadius(-7.040736, 113.558258)
    expect(result.isWithinRadius).toBe(true)
    expect(result.distanceM).toBeGreaterThan(50)
    expect(result.distanceM).toBeLessThan(200)
  })

  it('point ~667m away is outside 500m radius', () => {
    const result = checkRadius(-7.035736, 113.558258)
    expect(result.isWithinRadius).toBe(false)
    expect(result.distanceM).toBeGreaterThan(CHECKIN_RADIUS_METERS)
  })

  it('radius constant is 500', () => {
    expect(CHECKIN_RADIUS_METERS).toBe(500)
  })
})

describe('getTodayWIB', () => {
  it('returns string in YYYY-MM-DD format', () => {
    const result = getTodayWIB()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
