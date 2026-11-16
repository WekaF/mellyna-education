import {
  REPORT_GATE_FROM,
  scheduleDayWIB,
  scheduleStartAt,
  checkInOpensAt,
  checkInWindow,
  isLateCheckIn,
  decideReportAccess,
  dailyCheckInOpensAt,
  dailyCheckInWindow,
  isLateDailyCheckIn,
  isValidDailyCheckInTime,
} from '@/lib/checkin-policy'

// Schedule.date disimpan sebagai 00:00 UTC = 07:00 WIB di hari yang sama
const date = new Date('2026-10-20')

describe('scheduleDayWIB', () => {
  it('returns the WIB calendar day of a schedule stored at UTC midnight', () => {
    expect(scheduleDayWIB(date)).toBe('2026-10-20')
  })

  it('treats 17:00 UTC of the previous day as the next WIB day', () => {
    expect(scheduleDayWIB(new Date('2026-10-19T17:00:00Z'))).toBe('2026-10-20')
  })
})

describe('scheduleStartAt', () => {
  it('combines WIB day and HH:MM start time', () => {
    expect(scheduleStartAt(date, '15:00').toISOString()).toBe('2026-10-20T08:00:00.000Z')
  })

  it('pads single-digit hours', () => {
    expect(scheduleStartAt(date, '9:00').toISOString()).toBe('2026-10-20T02:00:00.000Z')
  })

  it('falls back to start of the WIB day when startTime is unparseable', () => {
    expect(scheduleStartAt(date, 'abc').toISOString()).toBe('2026-10-19T17:00:00.000Z')
  })
})

describe('checkInWindow', () => {
  it('opens 30 minutes before start', () => {
    expect(checkInOpensAt(date, '15:00').toISOString()).toBe('2026-10-20T07:30:00.000Z')
  })

  it('is not-open one second before opening', () => {
    expect(checkInWindow(date, '15:00', new Date('2026-10-20T07:29:59Z'))).toBe('not-open')
  })

  it('is open exactly at opening time', () => {
    expect(checkInWindow(date, '15:00', new Date('2026-10-20T07:30:00Z'))).toBe('open')
  })

  it('stays open until 23:59:59 WIB of the schedule day', () => {
    expect(checkInWindow(date, '15:00', new Date('2026-10-20T16:59:59Z'))).toBe('open')
  })

  it('is closed at 00:00 WIB of the next day', () => {
    expect(checkInWindow(date, '15:00', new Date('2026-10-20T17:00:00Z'))).toBe('closed')
  })
})

describe('isLateCheckIn', () => {
  it('is not late exactly at start time', () => {
    expect(isLateCheckIn(date, '15:00', new Date('2026-10-20T08:00:00Z'))).toBe(false)
  })

  it('is late one second after start time', () => {
    expect(isLateCheckIn(date, '15:00', new Date('2026-10-20T08:00:01Z'))).toBe(true)
  })
})

describe('dailyCheckInWindow (absen harian jam 15:00)', () => {
  it('opens 30 minutes before 15:00 WIB', () => {
    expect(dailyCheckInOpensAt('2026-10-20').toISOString()).toBe('2026-10-20T07:30:00.000Z')
  })

  it('is not-open one second before opening', () => {
    expect(dailyCheckInWindow('2026-10-20', new Date('2026-10-20T07:29:59Z'))).toBe('not-open')
  })

  it('is open exactly at opening time', () => {
    expect(dailyCheckInWindow('2026-10-20', new Date('2026-10-20T07:30:00Z'))).toBe('open')
  })

  it('stays open until 23:59:59 WIB of the same day', () => {
    expect(dailyCheckInWindow('2026-10-20', new Date('2026-10-20T16:59:59Z'))).toBe('open')
  })

  it('is closed at 00:00 WIB of the next day', () => {
    expect(dailyCheckInWindow('2026-10-20', new Date('2026-10-20T17:00:00Z'))).toBe('closed')
  })

  it('opens 30 minutes before a custom configured time (14:40)', () => {
    expect(dailyCheckInOpensAt('2026-10-20', '14:40').toISOString()).toBe('2026-10-20T07:10:00.000Z')
  })

  it('respects a custom configured time when checking the window', () => {
    expect(dailyCheckInWindow('2026-10-20', new Date('2026-10-20T07:09:59Z'), '14:40')).toBe('not-open')
    expect(dailyCheckInWindow('2026-10-20', new Date('2026-10-20T07:10:00Z'), '14:40')).toBe('open')
  })
})

describe('isValidDailyCheckInTime', () => {
  it.each(['00:00', '09:05', '14:40', '15:00', '23:59'])('accepts %s', (value) => {
    expect(isValidDailyCheckInTime(value)).toBe(true)
  })

  it.each(['24:00', '15:60', '9:05', '1500', 'abc', ''])('rejects %s', (value) => {
    expect(isValidDailyCheckInTime(value)).toBe(false)
  })
})

describe('isLateDailyCheckIn', () => {
  it('is not late exactly at 15:00 WIB', () => {
    expect(isLateDailyCheckIn('2026-10-20', new Date('2026-10-20T08:00:00Z'))).toBe(false)
  })

  it('is late against a custom configured time (14:40)', () => {
    expect(isLateDailyCheckIn('2026-10-20', new Date('2026-10-20T07:40:00Z'), '14:40')).toBe(false)
    expect(isLateDailyCheckIn('2026-10-20', new Date('2026-10-20T07:40:01Z'), '14:40')).toBe(true)
  })

  it('is late one second after 15:00 WIB', () => {
    expect(isLateDailyCheckIn('2026-10-20', new Date('2026-10-20T08:00:01Z'))).toBe(true)
  })
})

// Laporan sekarang tidak lagi digembok oleh status absen — kelas pagi (mis. jam 8/11) harus
// tetap bisa dilaporkan walau absen harian baru buka jam 15:00.
describe('decideReportAccess', () => {
  const gated = new Date(REPORT_GATE_FROM)
  const beforeGate = new Date(gated.getTime() - 24 * 60 * 60 * 1000)

  it.each([
    { hasValidCheckIn: false, requestStatus: null },
    { hasValidCheckIn: true, requestStatus: null },
    { hasValidCheckIn: false, requestStatus: 'APPROVED' as const },
    { hasValidCheckIn: false, requestStatus: 'PENDING' as const },
    { hasValidCheckIn: false, requestStatus: 'REJECTED' as const },
  ])('always allows regardless of check-in or request status (%j)', (input) => {
    expect(decideReportAccess({ scheduleDate: gated, ...input })).toEqual({ allowed: true, reason: 'exempt' })
  })

  it('allows schedules before the gate date too', () => {
    expect(
      decideReportAccess({ scheduleDate: beforeGate, hasValidCheckIn: false, requestStatus: null }),
    ).toEqual({ allowed: true, reason: 'exempt' })
  })
})
