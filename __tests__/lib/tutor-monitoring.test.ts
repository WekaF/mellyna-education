import { summarizeTutorAttendance } from '@/lib/tutor-monitoring'

const schedules = [
  { id: 's1', date: new Date('2026-10-20'), startTime: '15:00' },
  { id: 's2', date: new Date('2026-10-20'), startTime: '19:00' },
  { id: 's3', date: new Date('2026-10-05'), startTime: '15:00' },
]

const checkIn = (over: object) => ({
  id: 'c',
  scheduleId: null as string | null,
  date: '2026-10-20',
  checkedInAt: new Date('2026-10-20T07:50:00Z'),
  distanceM: 40,
  isWithinRadius: true,
  ...over,
})

describe('summarizeTutorAttendance', () => {
  it('returns null rate and zero counts with no schedules', () => {
    expect(summarizeTutorAttendance([], [])).toMatchObject({
      totalSessions: 0,
      validSessions: 0,
      lateSessions: 0,
      attendanceRate: null,
      avgDistanceM: null,
      lastCheckIn: null,
      recentCheckIns: [],
    })
  })

  it('counts one valid session per schedule check-in, not per day', () => {
    const s = summarizeTutorAttendance(schedules, [checkIn({ id: 'c1', scheduleId: 's1' })])
    expect(s.totalSessions).toBe(3)
    expect(s.validSessions).toBe(1)
    expect(s.attendanceRate).toBe(33)
  })

  it('ignores check-ins outside the radius', () => {
    const s = summarizeTutorAttendance(schedules, [checkIn({ scheduleId: 's1', isWithinRadius: false })])
    expect(s.validSessions).toBe(0)
  })

  it('counts a legacy per-day check-in for every schedule on that date', () => {
    const s = summarizeTutorAttendance(schedules, [checkIn({ scheduleId: null, date: '2026-10-20' })])
    expect(s.validSessions).toBe(2)
  })

  it('flags late check-ins made after the session start', () => {
    const s = summarizeTutorAttendance(schedules, [
      checkIn({ id: 'c1', scheduleId: 's1', checkedInAt: new Date('2026-10-20T08:05:00Z') }),
      checkIn({ id: 'c2', scheduleId: 's2', checkedInAt: new Date('2026-10-20T11:50:00Z') }),
    ])
    expect(s.lateSessions).toBe(1)
    expect(s.recentCheckIns.find((c) => c.id === 'c1')).toMatchObject({ late: true, startTime: '15:00' })
    expect(s.recentCheckIns.find((c) => c.id === 'c2')).toMatchObject({ late: false, startTime: '19:00' })
  })

  it('reports average distance and keeps at most 7 recent check-ins', () => {
    const many = Array.from({ length: 9 }, (_, i) => checkIn({ id: `c${i}`, distanceM: 10 + i }))
    const s = summarizeTutorAttendance(schedules, many)
    expect(s.recentCheckIns).toHaveLength(7)
    expect(s.avgDistanceM).toBe(14)
    expect(s.lastCheckIn).toBe('2026-10-20T07:50:00.000Z')
  })
})
