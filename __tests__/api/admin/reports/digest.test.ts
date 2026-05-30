import { GET } from '@/app/api/admin/reports/digest/route'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
}))

describe('GET /api/admin/reports/digest', () => {
  it('returns 401 for unauthenticated requests', async () => {
    const req = new NextRequest('http://localhost/api/admin/reports/digest')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})
