import { GET } from '@/app/api/tutors/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

jest.mock('next-auth')
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: { user: { findMany: jest.fn() } },
}))

describe('GET /api/tutors', () => {
  it('returns 401 for unauthenticated requests', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const req = new Request('http://localhost/api/tutors')
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })

  it('returns 403 for PARENT role', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'PARENT' } })
    const req = new Request('http://localhost/api/tutors')
    const res = await GET(req as any)
    expect(res.status).toBe(403)
  })

  it('returns 200 for ADMIN role', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } })
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([])
    const req = new Request('http://localhost/api/tutors')
    const res = await GET(req as any)
    expect(res.status).toBe(200)
  })

  it('returns 200 for SUPER_ADMIN role', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([])
    const req = new Request('http://localhost/api/tutors')
    const res = await GET(req as any)
    expect(res.status).toBe(200)
  })
})
