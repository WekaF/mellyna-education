import { GET, POST } from '@/app/api/report-access/route'
import { PATCH } from '@/app/api/admin/report-access/[id]/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'
import { getTutorReportAccess } from '@/lib/report-access'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/report-access', () => ({ getTutorReportAccess: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    reportAccessRequest: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  },
}))

const json = (url: string, method: string, body: object) =>
  new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

const asTutor = () =>
  (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 't1', role: 'TUTOR' } })
const asSuperAdmin = () =>
  (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'sa1', role: 'SUPER_ADMIN' } })

const blocked = (request: object | null = null) => ({
  allowed: false,
  reason: 'no-checkin',
  checkInWindow: 'closed',
  request,
})

beforeEach(() => jest.clearAllMocks())

describe('GET /api/report-access', () => {
  it('returns 400 without scheduleId', async () => {
    asTutor()
    expect((await GET(new NextRequest('http://localhost/api/report-access'))).status).toBe(400)
  })

  it('returns the tutor’s access for the schedule', async () => {
    asTutor()
    ;(getTutorReportAccess as jest.Mock).mockResolvedValue(blocked())
    const res = await GET(new NextRequest('http://localhost/api/report-access?scheduleId=s1'))
    expect(await res.json()).toMatchObject({ allowed: false, reason: 'no-checkin' })
    expect(getTutorReportAccess).toHaveBeenCalledWith('t1', 's1')
  })

  it('always allows admins without a lookup', async () => {
    asSuperAdmin()
    const res = await GET(new NextRequest('http://localhost/api/report-access?scheduleId=s1'))
    expect((await res.json()).allowed).toBe(true)
    expect(getTutorReportAccess).not.toHaveBeenCalled()
  })
})

describe('POST /api/report-access', () => {
  const post = (body: object) => POST(json('http://localhost/api/report-access', 'POST', body))

  it('returns 403 for non-tutor', async () => {
    asSuperAdmin()
    expect((await post({ scheduleId: 's1', reason: 'GPS rusak' })).status).toBe(403)
  })

  it('returns 400 when reason is too short', async () => {
    asTutor()
    expect((await post({ scheduleId: 's1', reason: 'ok' })).status).toBe(400)
  })

  it('returns 404 when schedule does not exist', async () => {
    asTutor()
    ;(getTutorReportAccess as jest.Mock).mockResolvedValue({ ...blocked(), reason: 'schedule-not-found' })
    expect((await post({ scheduleId: 's1', reason: 'GPS rusak' })).status).toBe(404)
  })

  it('returns 409 when access is already open', async () => {
    asTutor()
    ;(getTutorReportAccess as jest.Mock).mockResolvedValue({ ...blocked(), allowed: true, reason: 'checked-in' })
    expect((await post({ scheduleId: 's1', reason: 'GPS rusak' })).status).toBe(409)
  })

  it('returns 409 when a request is already pending', async () => {
    asTutor()
    ;(getTutorReportAccess as jest.Mock).mockResolvedValue(blocked({ id: 'r1', status: 'PENDING' }))
    expect((await post({ scheduleId: 's1', reason: 'GPS rusak' })).status).toBe(409)
    expect(prisma.reportAccessRequest.upsert).not.toHaveBeenCalled()
  })

  it('creates a pending request, and resets a rejected one', async () => {
    asTutor()
    ;(getTutorReportAccess as jest.Mock).mockResolvedValue(blocked({ id: 'r1', status: 'REJECTED' }))
    ;(prisma.reportAccessRequest.upsert as jest.Mock).mockResolvedValue({
      id: 'r1',
      status: 'PENDING',
      reason: 'GPS rusak',
      adminNote: null,
    })
    const res = await post({ scheduleId: 's1', reason: 'GPS rusak' })
    expect(res.status).toBe(201)
    expect(prisma.reportAccessRequest.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tutorId_scheduleId: { tutorId: 't1', scheduleId: 's1' } },
        create: { tutorId: 't1', scheduleId: 's1', reason: 'GPS rusak' },
        update: { reason: 'GPS rusak', status: 'PENDING', adminNote: null, decidedAt: null, decidedById: null },
      }),
    )
  })
})

describe('PATCH /api/admin/report-access/[id]', () => {
  const patch = (body: object) =>
    PATCH(json('http://localhost/api/admin/report-access/r1', 'PATCH', body), {
      params: Promise.resolve({ id: 'r1' }),
    })

  it('returns 403 for non-super-admin', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } })
    expect((await patch({ status: 'APPROVED' })).status).toBe(403)
  })

  it('returns 400 for an invalid status', async () => {
    asSuperAdmin()
    expect((await patch({ status: 'PENDING' })).status).toBe(400)
  })

  it('returns 404 when the request does not exist', async () => {
    asSuperAdmin()
    ;(prisma.reportAccessRequest.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await patch({ status: 'APPROVED' })).status).toBe(404)
  })

  it('records the decision and who made it', async () => {
    asSuperAdmin()
    ;(prisma.reportAccessRequest.findUnique as jest.Mock).mockResolvedValue({ id: 'r1' })
    ;(prisma.reportAccessRequest.update as jest.Mock).mockResolvedValue({ id: 'r1', status: 'REJECTED' })
    const res = await patch({ status: 'REJECTED', adminNote: 'Tidak hadir' })
    expect(res.status).toBe(200)
    expect(prisma.reportAccessRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({
          status: 'REJECTED',
          adminNote: 'Tidak hadir',
          decidedById: 'sa1',
          decidedAt: expect.any(Date),
        }),
      }),
    )
  })
})
