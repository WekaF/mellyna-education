import { haversineDistance, checkRadius, getTodayWIB, CHECKIN_CENTER, CHECKIN_RADIUS_METERS, CHECKIN_MAX_ACCURACY_ALLOWANCE_M } from '@/lib/geolocation'

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
  // 0.0001° lintang ≈ 11,1 m
  const at = (latOffsetDeg: number, accuracyM?: number) =>
    checkRadius(CHECKIN_CENTER.lat + latOffsetDeg, CHECKIN_CENTER.lng, accuracyM)

  it('center point is within radius', () => {
    const result = at(0)
    expect(result.isWithinRadius).toBe(true)
    expect(result.distanceM).toBe(0)
  })

  it('radius is 10 m with a 30 m accuracy allowance cap', () => {
    expect(CHECKIN_RADIUS_METERS).toBe(10)
    expect(CHECKIN_MAX_ACCURACY_ALLOWANCE_M).toBe(30)
  })

  it('rejects a point ~11 m away when no accuracy is reported', () => {
    expect(at(0.0001).isWithinRadius).toBe(false)
  })

  it('accepts a point ~11 m away when GPS accuracy is 5 m', () => {
    expect(at(0.0001, 5).isWithinRadius).toBe(true)
  })

  it('accepts a point ~33 m away when GPS accuracy is 30 m', () => {
    expect(at(0.0003, 30).isWithinRadius).toBe(true)
  })

  it('caps the allowance: ~44 m away is rejected even with 100 m accuracy', () => {
    expect(at(0.0004, 100).isWithinRadius).toBe(false)
  })

  it('ignores negative accuracy', () => {
    expect(at(0.0001, -50).isWithinRadius).toBe(false)
  })

  it('reports the true distance, not the adjusted one', () => {
    const d = at(0.0003, 30).distanceM
    expect(d).toBeGreaterThan(30)
    expect(d).toBeLessThan(37)
  })
})

describe('getTodayWIB', () => {
  it('returns string in YYYY-MM-DD format', () => {
    const result = getTodayWIB()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
