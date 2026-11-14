import { GET, POST } from '@/app/api/tutor/leave-requests/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: { tutorLeaveRequest: { findMany: jest.fn(), create: jest.fn() } },
}))

const postReq = (body: object) =>
  new NextRequest('http://x/api/tutor/leave-requests', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 't1', role: 'TUTOR' } })
})

describe('GET /api/tutor/leave-requests', () => {
  it('returns 403 for a non-tutor', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } })
    expect((await GET()).status).toBe(403)
  })

  it('lists only the tutor own requests', async () => {
    ;(prisma.tutorLeaveRequest.findMany as jest.Mock).mockResolvedValue([])
    expect((await GET()).status).toBe(200)
    expect(prisma.tutorLeaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tutorId: 't1' } }),
    )
  })
})

describe('POST /api/tutor/leave-requests', () => {
  it('returns 400 without a reason', async () => {
    expect((await POST(postReq({ date: '2026-11-10' }))).status).toBe(400)
  })

  it('creates a pending tutor-submitted request', async () => {
    ;(prisma.tutorLeaveRequest.create as jest.Mock).mockResolvedValue({ id: 'l1' })
    const res = await POST(postReq({ date: '2026-11-10', reason: 'Sakit' }))
    expect(res.status).toBe(200)
    expect(prisma.tutorLeaveRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tutorId: 't1', source: 'TUTOR_REQUEST', status: 'PENDING' }),
      }),
    )
  })
})
