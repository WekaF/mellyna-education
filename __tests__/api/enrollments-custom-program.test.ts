import { POST } from '@/app/api/enrollments/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

jest.mock('next-auth')
jest.mock('@/lib/db', () => ({ prisma: { programEnrollment: { findMany: jest.fn() }, classProgram: { findMany: jest.fn() }, enrollment: { upsert: jest.fn() } } }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

const post = () =>
  POST(new Request('http://localhost/api/enrollments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 's1', classId: 'c1' }),
  }) as any)

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } })
  ;(prisma.programEnrollment.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.enrollment.upsert as jest.Mock).mockResolvedValue({ id: 'e1' })
})

describe('POST /api/enrollments - custom main program', () => {
  it('enrolls freely when class has no enum programs', async () => {
    ;(prisma.classProgram.findMany as jest.Mock).mockResolvedValue([])
    const res = await post()
    expect(res.status).toBe(201)
    const arg = (prisma.enrollment.upsert as jest.Mock).mock.calls[0][0]
    expect(arg.create.programEnrollmentId).toBeNull()
    expect(arg.update.programEnrollmentId).toBeNull()
  })

  it('still 422 when class has programs and student has none active', async () => {
    ;(prisma.classProgram.findMany as jest.Mock).mockResolvedValue([{ program: 'SEMPOA' }])
    const res = await post()
    expect(res.status).toBe(422)
  })
})
