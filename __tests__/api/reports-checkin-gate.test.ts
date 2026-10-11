import { PUT } from '@/app/api/reports/[id]/route'
import { POST } from '@/app/api/reports/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'
import { getTutorReportAccess } from '@/lib/report-access'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/report-notify', () => ({ notifyParentNewReport: jest.fn() }))
jest.mock('@/lib/report-access', () => ({ getTutorReportAccess: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    learningReport: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
  },
}))

const body = { studentId: 'st1', scheduleId: 's1', content: 'Bagus' }
const makeReq = () =>
  new NextRequest('http://localhost/api/reports', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

describe('POST /api/reports — check-in gate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // parentNotifiedAt terisi → jalur notifikasi WA tidak jalan di test
    ;(prisma.learningReport.findUnique as jest.Mock).mockResolvedValue({ id: 'r1', parentNotifiedAt: new Date() })
    ;(prisma.learningReport.upsert as jest.Mock).mockResolvedValue({ id: 'r1' })
  })

  it('blocks a tutor without report access', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 't1', role: 'TUTOR' } })
    ;(getTutorReportAccess as jest.Mock).mockResolvedValue({ allowed: false, reason: 'no-checkin' })
    const res = await POST(makeReq())
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('CHECKIN_REQUIRED')
    expect(prisma.learningReport.upsert).not.toHaveBeenCalled()
  })

  it('lets a tutor with report access save', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 't1', role: 'TUTOR' } })
    ;(getTutorReportAccess as jest.Mock).mockResolvedValue({ allowed: true, reason: 'checked-in' })
    const res = await POST(makeReq())
    expect(res.status).toBe(201)
    expect(getTutorReportAccess).toHaveBeenCalledWith('t1', 's1')
    expect(prisma.learningReport.upsert).toHaveBeenCalled()
  })

  it.each(['ADMIN', 'SUPER_ADMIN'])('does not gate %s', async (role) => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'a1', role } })
    const res = await POST(makeReq())
    expect(res.status).toBe(201)
    expect(getTutorReportAccess).not.toHaveBeenCalled()
  })
})

describe('PUT /api/reports/[id] — check-in gate', () => {
  const putReq = () =>
    new NextRequest('http://localhost/api/reports/r1', {
      method: 'PUT',
      body: JSON.stringify({ content: 'Revisi' }),
      headers: { 'Content-Type': 'application/json' },
    })
  const call = () => PUT(putReq(), { params: Promise.resolve({ id: 'r1' }) })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.learningReport.findUnique as jest.Mock).mockResolvedValue({ scheduleId: 's1' })
    ;(prisma.learningReport.update as jest.Mock).mockResolvedValue({ id: 'r1' })
  })

  it('blocks a tutor without report access', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 't1', role: 'TUTOR' } })
    ;(getTutorReportAccess as jest.Mock).mockResolvedValue({ allowed: false, reason: 'no-checkin' })
    const res = await call()
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('CHECKIN_REQUIRED')
    expect(prisma.learningReport.update).not.toHaveBeenCalled()
  })

  it('lets a tutor with report access update', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 't1', role: 'TUTOR' } })
    ;(getTutorReportAccess as jest.Mock).mockResolvedValue({ allowed: true, reason: 'checked-in' })
    const res = await call()
    expect(res.status).toBe(200)
    expect(getTutorReportAccess).toHaveBeenCalledWith('t1', 's1')
    expect(prisma.learningReport.update).toHaveBeenCalled()
  })

  it('does not gate ADMIN', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } })
    const res = await call()
    expect(res.status).toBe(200)
    expect(getTutorReportAccess).not.toHaveBeenCalled()
  })
})
