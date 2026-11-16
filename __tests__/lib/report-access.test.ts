import { getTutorReportAccess } from '@/lib/report-access'
import { prisma } from '@/lib/db'
import { REPORT_GATE_FROM, scheduleDayWIB } from '@/lib/checkin-policy'

jest.mock('@/lib/db', () => ({
  prisma: {
    schedule: { findFirst: jest.fn() },
    tutorCheckIn: { findUnique: jest.fn(), findFirst: jest.fn() },
    reportAccessRequest: { findUnique: jest.fn() },
  },
}))

const gatedSchedule = { date: new Date(REPORT_GATE_FROM), startTime: '15:00' }

describe('getTutorReportAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.schedule.findFirst as jest.Mock).mockResolvedValue(gatedSchedule)
    ;(prisma.tutorCheckIn.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.tutorCheckIn.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.reportAccessRequest.findUnique as jest.Mock).mockResolvedValue(null)
  })

  it('reports schedule-not-found when schedule does not exist', async () => {
    ;(prisma.schedule.findFirst as jest.Mock).mockResolvedValue(null)
    expect(await getTutorReportAccess('t1', 's1')).toEqual({
      allowed: false,
      reason: 'schedule-not-found',
      checkInWindow: null,
      request: null,
    })
  })

  it('only looks at schedules of classes the tutor teaches (primary or additional)', async () => {
    await getTutorReportAccess('t1', 's1')
    expect(prisma.schedule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 's1',
          OR: [
            { class: { tutorId: 't1' } },
            { class: { additionalTutors: { some: { tutorId: 't1' } } } },
          ],
        },
      }),
    )
  })

  it('looks up check-in and request by tutor + schedule', async () => {
    await getTutorReportAccess('t1', 's1')
    const where = { tutorId_scheduleId: { tutorId: 't1', scheduleId: 's1' } }
    expect(prisma.tutorCheckIn.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where }))
    expect(prisma.reportAccessRequest.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where }))
  })

  // Laporan tidak lagi digembok oleh absen — kelas pagi harus tetap bisa dilaporkan
  // walau absen harian (jam 15:00 atau jam custom) belum dilakukan.
  it('allows even with no check-in and no request', async () => {
    const access = await getTutorReportAccess('t1', 's1')
    expect(access.allowed).toBe(true)
    expect(access.reason).toBe('exempt')
  })

  it('allows even when the only check-in is outside the radius', async () => {
    ;(prisma.tutorCheckIn.findUnique as jest.Mock).mockResolvedValue({ isWithinRadius: false })
    expect((await getTutorReportAccess('t1', 's1')).allowed).toBe(true)
  })

  it('allows with a valid check-in', async () => {
    ;(prisma.tutorCheckIn.findUnique as jest.Mock).mockResolvedValue({ isWithinRadius: true })
    const access = await getTutorReportAccess('t1', 's1')
    expect(access).toMatchObject({ allowed: true, reason: 'exempt' })
  })

  it('allows with an approved request and returns the request', async () => {
    const request = { id: 'r1', status: 'APPROVED', reason: 'GPS rusak', adminNote: null }
    ;(prisma.reportAccessRequest.findUnique as jest.Mock).mockResolvedValue(request)
    const access = await getTutorReportAccess('t1', 's1')
    expect(access).toMatchObject({ allowed: true, reason: 'exempt', request })
  })

  it('allows with a valid daily check-in even without a per-schedule check-in', async () => {
    ;(prisma.tutorCheckIn.findFirst as jest.Mock).mockResolvedValue({ isWithinRadius: true })
    const access = await getTutorReportAccess('t1', 's1')
    expect(access).toMatchObject({ allowed: true, reason: 'exempt' })
    expect(prisma.tutorCheckIn.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tutorId: 't1', scheduleId: null, date: scheduleDayWIB(gatedSchedule.date) },
      }),
    )
  })

  it('allows even when a daily check-in was outside the radius', async () => {
    ;(prisma.tutorCheckIn.findFirst as jest.Mock).mockResolvedValue({ isWithinRadius: false })
    const access = await getTutorReportAccess('t1', 's1')
    expect(access.allowed).toBe(true)
  })
})
