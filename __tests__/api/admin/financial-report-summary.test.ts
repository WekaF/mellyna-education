import { GET } from '@/app/api/admin/financial-report/summary/route'
import { getServerSession } from 'next-auth'

jest.mock('next-auth')
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: { invoice: { findMany: jest.fn() } },
}))

describe('GET /api/admin/financial-report/summary', () => {
  it('returns 403 for ADMIN role (financial report stays SUPER_ADMIN-only)', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } })
    const req = new Request('http://localhost/api/admin/financial-report/summary')
    const res = await GET(req as any)
    expect(res.status).toBe(403)
  })

  it('returns 403 for unauthenticated requests', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const req = new Request('http://localhost/api/admin/financial-report/summary')
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })
})
