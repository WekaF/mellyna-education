import { POST } from '@/app/api/admin/payroll/generate/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'
import { gatherPayrollCounts } from '@/lib/payroll'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    user: { findMany: jest.fn() },
    payrollEntry: { findUnique: jest.fn(), upsert: jest.fn() },
    tutorPayrollRate: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/payroll', () => ({
  ...jest.requireActual('@/lib/payroll'),
  gatherPayrollCounts: jest.fn(),
}))

const makeReq = (body: object) =>
  new NextRequest('http://localhost/api/admin/payroll/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

const rate = { dailyRate: 50000, onTimeBonusRate: 10000, overtimeRatePerHour: 20000, extraHandleRate: 30000 }
const counts = { hariKerja: 1, bonusOntimeDays: 1, izinHari: 0, extraTimeHours: 0, extraHandleCount: 0 }

describe('POST /api/admin/payroll/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 't1' }])
    ;(prisma.payrollEntry.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.tutorPayrollRate.findUnique as jest.Mock).mockResolvedValue(rate)
    ;(gatherPayrollCounts as jest.Mock).mockResolvedValue(counts)
    ;(prisma.payrollEntry.upsert as jest.Mock).mockImplementation(async ({ create }) => ({ id: 'p1', ...create }))
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    expect((await POST(makeReq({ periodMonth: '2026-11' }))).status).toBe(401)
  })

  it('returns 403 for a tutor', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'TUTOR' } })
    expect((await POST(makeReq({ periodMonth: '2026-11' }))).status).toBe(403)
  })

  it('returns 400 for a malformed periodMonth', async () => {
    expect((await POST(makeReq({ periodMonth: '2026-13' }))).status).toBe(400)
  })

  it('generates an entry for a tutor that has a rate configured', async () => {
    const res = await POST(makeReq({ periodMonth: '2026-11' }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.results).toEqual([{ tutorId: 't1', entry: expect.objectContaining({ totalAmount: expect.any(Number) }) }])
    expect(prisma.payrollEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tutorId_periodMonth: { tutorId: 't1', periodMonth: '2026-11' } },
        create: expect.objectContaining({ tutorId: 't1', periodMonth: '2026-11', totalAmount: 60000 }),
      }),
    )
  })

  it('skips a tutor with no payroll rate configured and does not write anything', async () => {
    ;(prisma.tutorPayrollRate.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ periodMonth: '2026-11' }))
    const data = await res.json()
    expect(data.results).toEqual([{ tutorId: 't1', skipped: true, reason: 'no-rate' }])
    expect(prisma.payrollEntry.upsert).not.toHaveBeenCalled()
  })

  it('skips a tutor whose entry for that month is already finalized', async () => {
    ;(prisma.payrollEntry.findUnique as jest.Mock).mockResolvedValue({ status: 'FINALIZED' })
    const res = await POST(makeReq({ periodMonth: '2026-11' }))
    const data = await res.json()
    expect(data.results).toEqual([{ tutorId: 't1', skipped: true, reason: 'finalized' }])
    expect(prisma.payrollEntry.upsert).not.toHaveBeenCalled()
  })
})
