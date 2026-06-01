import { POST } from '@/app/api/enrollments/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

jest.mock('next-auth')
jest.mock('@/lib/db', () => ({ prisma: { programEnrollment: { findMany: jest.fn() }, classProgram: { findMany: jest.fn() }, enrollment: { upsert: jest.fn() } } }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockSession = { user: { role: 'SUPER_ADMIN' } }

describe('POST /api/enrollments - multi-program', () => {
  it('enrolls student whose second active program matches class', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.programEnrollment.findMany as jest.Mock).mockResolvedValue([
      { id: 'pe1', program: 'SEMPOA', studentId: 's1' },
      { id: 'pe2', program: 'MATEMATIKA', studentId: 's1' },
    ])
    ;(prisma.classProgram.findMany as jest.Mock).mockResolvedValue([
      { program: 'MATEMATIKA' },
    ])
    ;(prisma.enrollment.upsert as jest.Mock).mockResolvedValue({ id: 'e1', studentId: 's1', classId: 'c1' })

    const req = new Request('http://localhost/api/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 's1', classId: 'c1' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
  })

  it('returns 422 when no active program matches class', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.programEnrollment.findMany as jest.Mock).mockResolvedValue([
      { id: 'pe1', program: 'SEMPOA', studentId: 's1' },
    ])
    ;(prisma.classProgram.findMany as jest.Mock).mockResolvedValue([
      { program: 'MATEMATIKA' },
    ])

    const req = new Request('http://localhost/api/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 's1', classId: 'c1' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(422)
  })
})
