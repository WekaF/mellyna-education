import { getTutorReportAccess } from '@/lib/report-access'
import { prisma } from '@/lib/db'
import { REPORT_GATE_FROM } from '@/lib/checkin-policy'

jest.mock('@/lib/db', () => ({
  prisma: {
    schedule: { findUnique: jest.fn() },
    tutorCheckIn: { findUnique: jest.fn() },
    reportAccessRequest: { findUnique: jest.fn() },
  },
}))

const gatedSchedule = { date: new Date(REPORT_GATE_FROM), startTime: '15:00' }

describe('getTutorReportAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.schedule.findUnique as jest.Mock).mockResolvedValue(gatedSchedule)
    ;(prisma.tutorCheckIn.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.reportAccessRequest.findUnique as jest.Mock).mockResolvedValue(null)
  })

  it('reports schedule-not-found when schedule does not exist', async () => {
    ;(prisma.schedule.findUnique as jest.Mock).mockResolvedValue(null)
    expect(await getTutorReportAccess('t1', 's1')).toEqual({
      allowed: false,
      reason: 'schedule-not-found',
      checkInWindow: null,
      request: null,
    })
  })

  it('looks up check-in and request by tutor + schedule', async () => {
    await getTutorReportAccess('t1', 's1')
    const where = { tutorId_scheduleId: { tutorId: 't1', scheduleId: 's1' } }
    expect(prisma.tutorCheckIn.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where }))
    expect(prisma.reportAccessRequest.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where }))
  })

  it('blocks when there is no check-in and no request', async () => {
    const access = await getTutorReportAccess('t1', 's1')
    expect(access.allowed).toBe(false)
    expect(access.reason).toBe('no-checkin')
  })

  it('blocks when the only check-in is outside the radius', async () => {
    ;(prisma.tutorCheckIn.findUnique as jest.Mock).mockResolvedValue({ isWithinRadius: false })
    expect((await getTutorReportAccess('t1', 's1')).allowed).toBe(false)
  })

  it('allows with a valid check-in', async () => {
    ;(prisma.tutorCheckIn.findUnique as jest.Mock).mockResolvedValue({ isWithinRadius: true })
    const access = await getTutorReportAccess('t1', 's1')
    expect(access).toMatchObject({ allowed: true, reason: 'checked-in' })
  })

  it('allows with an approved request and returns the request', async () => {
    const request = { id: 'r1', status: 'APPROVED', reason: 'GPS rusak', adminNote: null }
    ;(prisma.reportAccessRequest.findUnique as jest.Mock).mockResolvedValue(request)
    const access = await getTutorReportAccess('t1', 's1')
    expect(access).toMatchObject({ allowed: true, reason: 'approved', request })
  })
})
