import { gatherPayrollCounts } from '@/lib/payroll'
import { prisma } from '@/lib/db'

jest.mock('@/lib/db', () => ({
  prisma: {
    tutorCheckIn: { findMany: jest.fn() },
    tutorLeaveRequest: { findMany: jest.fn() },
    schedule: { findMany: jest.fn() },
    tutorOvertimeEntry: { aggregate: jest.fn() },
  },
}))

describe('gatherPayrollCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.tutorCheckIn.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.tutorLeaveRequest.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.schedule.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.tutorOvertimeEntry.aggregate as jest.Mock).mockResolvedValue({ _sum: { hours: null } })
  })

  it('counts valid daily check-ins as hari kerja', async () => {
    ;(prisma.tutorCheckIn.findMany as jest.Mock).mockResolvedValue([
      { date: '2026-11-01', checkedInAt: new Date('2026-11-01T07:50:00Z') },
      { date: '2026-11-02', checkedInAt: new Date('2026-11-02T07:50:00Z') },
    ])
    const counts = await gatherPayrollCounts('t1', '2026-11')
    expect(counts.hariKerja).toBe(2)
    expect(prisma.tutorCheckIn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tutorId: 't1', scheduleId: null, isWithinRadius: true }),
      }),
    )
  })

  it('counts on-time days separately from late ones', async () => {
    ;(prisma.tutorCheckIn.findMany as jest.Mock).mockResolvedValue([
      { date: '2026-11-01', checkedInAt: new Date('2026-11-01T08:00:00Z') }, // tepat 15:00 WIB, tidak telat
      { date: '2026-11-02', checkedInAt: new Date('2026-11-02T08:00:01Z') }, // telat 1 detik
    ])
    const counts = await gatherPayrollCounts('t1', '2026-11')
    expect(counts.hariKerja).toBe(2)
    expect(counts.bonusOntimeDays).toBe(1)
  })

  it('counts approved leave requests as izin hari', async () => {
    ;(prisma.tutorLeaveRequest.findMany as jest.Mock).mockResolvedValue([{ id: 'l1' }, { id: 'l2' }])
    const counts = await gatherPayrollCounts('t1', '2026-11')
    expect(counts.izinHari).toBe(2)
    expect(prisma.tutorLeaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tutorId: 't1', status: 'APPROVED' }) }),
    )
  })

  it('sums overtime hours, defaulting to 0 when there are none', async () => {
    ;(prisma.tutorOvertimeEntry.aggregate as jest.Mock).mockResolvedValue({ _sum: { hours: 7.5 } })
    const counts = await gatherPayrollCounts('t1', '2026-11')
    expect(counts.extraTimeHours).toBe(7.5)
  })

  it('counts extra-handle schedules only on dates the tutor actually attended', async () => {
    ;(prisma.schedule.findMany as jest.Mock).mockResolvedValue([
      { id: 's1', date: new Date('2026-11-01') }, // attended
      { id: 's2', date: new Date('2026-11-05') }, // not attended
    ])
    ;(prisma.tutorCheckIn.findMany as jest.Mock).mockResolvedValue([
      { date: '2026-11-01', checkedInAt: new Date('2026-11-01T07:50:00Z') },
    ])
    const counts = await gatherPayrollCounts('t1', '2026-11')
    expect(counts.extraHandleCount).toBe(1)
    expect(prisma.schedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ class: { additionalTutors: { some: { tutorId: 't1' } } } }),
      }),
    )
  })

  it('returns all zeros when the tutor has no activity that month', async () => {
    const counts = await gatherPayrollCounts('t1', '2026-11')
    expect(counts).toEqual({ hariKerja: 0, bonusOntimeDays: 0, izinHari: 0, extraTimeHours: 0, extraHandleCount: 0 })
  })
})
