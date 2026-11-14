import { GET as getEntries } from '@/app/api/admin/payroll/route'
import { PATCH as finalizeEntry } from '@/app/api/admin/payroll/[id]/finalize/route'
import { GET as getRates, PUT as putRate } from '@/app/api/admin/payroll/rates/route'
import { GET as getLeaveRequests, POST as postLeaveRequest } from '@/app/api/admin/payroll/leave-requests/route'
import { PATCH as decideLeaveRequest } from '@/app/api/admin/payroll/leave-requests/[id]/route'
import { GET as getOvertime, POST as postOvertime } from '@/app/api/admin/payroll/overtime/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    payrollEntry: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    user: { findMany: jest.fn() },
    tutorPayrollRate: { upsert: jest.fn() },
    tutorLeaveRequest: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    tutorOvertimeEntry: { findMany: jest.fn(), create: jest.fn() },
  },
}))

const getReq = (url: string) => new NextRequest(url)
const postReq = (url: string, body: object) =>
  new NextRequest(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
const patchReq = (url: string, body: object) =>
  new NextRequest(url, { method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
})

describe('GET /api/admin/payroll', () => {
  it('returns 403 for a non-admin', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'TUTOR' } })
    expect((await getEntries(getReq('http://x/api/admin/payroll?periodMonth=2026-11'))).status).toBe(403)
  })

  it('returns 400 without a valid periodMonth', async () => {
    expect((await getEntries(getReq('http://x/api/admin/payroll'))).status).toBe(400)
  })

  it('lists entries for the given period', async () => {
    ;(prisma.payrollEntry.findMany as jest.Mock).mockResolvedValue([{ id: 'p1' }])
    const res = await getEntries(getReq('http://x/api/admin/payroll?periodMonth=2026-11'))
    expect(res.status).toBe(200)
    expect(prisma.payrollEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { periodMonth: '2026-11' } }),
    )
  })
})

describe('PATCH /api/admin/payroll/[id]/finalize', () => {
  const params = Promise.resolve({ id: 'p1' })

  it('returns 404 when the entry does not exist', async () => {
    ;(prisma.payrollEntry.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await finalizeEntry(patchReq('http://x', {}), { params })).status).toBe(404)
  })

  it('returns 422 when already finalized', async () => {
    ;(prisma.payrollEntry.findUnique as jest.Mock).mockResolvedValue({ status: 'FINALIZED' })
    expect((await finalizeEntry(patchReq('http://x', {}), { params })).status).toBe(422)
  })

  it('finalizes a draft entry', async () => {
    ;(prisma.payrollEntry.findUnique as jest.Mock).mockResolvedValue({ status: 'DRAFT' })
    ;(prisma.payrollEntry.update as jest.Mock).mockResolvedValue({ id: 'p1', status: 'FINALIZED' })
    const res = await finalizeEntry(patchReq('http://x', {}), { params })
    expect(res.status).toBe(200)
    expect(prisma.payrollEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1' }, data: expect.objectContaining({ status: 'FINALIZED' }) }),
    )
  })
})

describe('/api/admin/payroll/rates', () => {
  it('GET lists tutors with their rate', async () => {
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 't1', name: 'Budi', payrollRate: null }])
    const res = await getRates()
    expect(res.status).toBe(200)
  })

  it('PUT returns 400 for a non-integer rate', async () => {
    const res = await putRate(
      postReq('http://x', { tutorId: 't1', dailyRate: 1.5, onTimeBonusRate: 1, overtimeRatePerHour: 1, extraHandleRate: 1 }),
    )
    expect(res.status).toBe(400)
  })

  it('PUT upserts a valid rate', async () => {
    ;(prisma.tutorPayrollRate.upsert as jest.Mock).mockResolvedValue({ id: 'r1' })
    const res = await putRate(
      postReq('http://x', { tutorId: 't1', dailyRate: 50000, onTimeBonusRate: 10000, overtimeRatePerHour: 20000, extraHandleRate: 30000 }),
    )
    expect(res.status).toBe(200)
    expect(prisma.tutorPayrollRate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tutorId: 't1' } }),
    )
  })
})

describe('/api/admin/payroll/leave-requests', () => {
  it('GET lists requests', async () => {
    ;(prisma.tutorLeaveRequest.findMany as jest.Mock).mockResolvedValue([])
    expect((await getLeaveRequests(getReq('http://x/api/admin/payroll/leave-requests'))).status).toBe(200)
  })

  it('POST creates an auto-approved admin-marked leave', async () => {
    ;(prisma.tutorLeaveRequest.create as jest.Mock).mockResolvedValue({ id: 'l1' })
    const res = await postLeaveRequest(postReq('http://x', { tutorId: 't1', date: '2026-11-10', reason: 'Sakit' }))
    expect(res.status).toBe(200)
    expect(prisma.tutorLeaveRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tutorId: 't1', source: 'ADMIN_MARKED', status: 'APPROVED' }),
      }),
    )
  })

  it('PATCH [id] rejects deciding a request twice', async () => {
    ;(prisma.tutorLeaveRequest.findUnique as jest.Mock).mockResolvedValue({ status: 'APPROVED' })
    const res = await decideLeaveRequest(patchReq('http://x', { status: 'REJECTED' }), {
      params: Promise.resolve({ id: 'l1' }),
    })
    expect(res.status).toBe(422)
  })

  it('PATCH [id] approves a pending request', async () => {
    ;(prisma.tutorLeaveRequest.findUnique as jest.Mock).mockResolvedValue({ status: 'PENDING' })
    ;(prisma.tutorLeaveRequest.update as jest.Mock).mockResolvedValue({ id: 'l1', status: 'APPROVED' })
    const res = await decideLeaveRequest(patchReq('http://x', { status: 'APPROVED' }), {
      params: Promise.resolve({ id: 'l1' }),
    })
    expect(res.status).toBe(200)
  })
})

describe('/api/admin/payroll/overtime', () => {
  it('GET lists entries', async () => {
    ;(prisma.tutorOvertimeEntry.findMany as jest.Mock).mockResolvedValue([])
    expect((await getOvertime(getReq('http://x/api/admin/payroll/overtime'))).status).toBe(200)
  })

  it('POST returns 400 for zero hours', async () => {
    const res = await postOvertime(postReq('http://x', { tutorId: 't1', date: '2026-11-10', hours: 0 }))
    expect(res.status).toBe(400)
  })

  it('POST logs overtime hours', async () => {
    ;(prisma.tutorOvertimeEntry.create as jest.Mock).mockResolvedValue({ id: 'o1' })
    const res = await postOvertime(postReq('http://x', { tutorId: 't1', date: '2026-11-10', hours: 2.5, note: 'rapat ortu' }))
    expect(res.status).toBe(200)
    expect(prisma.tutorOvertimeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tutorId: 't1', hours: 2.5 }) }),
    )
  })
})
