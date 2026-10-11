import {
  REPORT_GATE_FROM,
  scheduleDayWIB,
  scheduleStartAt,
  checkInOpensAt,
  checkInWindow,
  isLateCheckIn,
  decideReportAccess,
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

describe('decideReportAccess', () => {
  const gated = new Date(REPORT_GATE_FROM)
  const beforeGate = new Date(gated.getTime() - 24 * 60 * 60 * 1000)

  it('exempts schedules before the gate date', () => {
    expect(
      decideReportAccess({ scheduleDate: beforeGate, hasValidCheckIn: false, requestStatus: null }),
    ).toEqual({ allowed: true, reason: 'exempt' })
  })

  it('allows when tutor has a valid check-in', () => {
    expect(
      decideReportAccess({ scheduleDate: gated, hasValidCheckIn: true, requestStatus: null }),
    ).toEqual({ allowed: true, reason: 'checked-in' })
  })

  it('allows when the access request is approved', () => {
    expect(
      decideReportAccess({ scheduleDate: gated, hasValidCheckIn: false, requestStatus: 'APPROVED' }),
    ).toEqual({ allowed: true, reason: 'approved' })
  })

  it.each([null, 'PENDING', 'REJECTED'] as const)('blocks without check-in when request is %s', (requestStatus) => {
    expect(
      decideReportAccess({ scheduleDate: gated, hasValidCheckIn: false, requestStatus }),
    ).toEqual({ allowed: false, reason: 'no-checkin' })
  })
})
