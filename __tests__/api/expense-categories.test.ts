import { GET } from '@/app/api/expense-categories/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    expenseCategory: { findMany: jest.fn() },
  },
}))

describe('GET /api/expense-categories', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-SUPER_ADMIN', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'TUTOR' } })
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns categories ordered by name', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
    ;(prisma.expenseCategory.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', name: 'Gaji' },
      { id: 'c2', name: 'Operasional' },
    ])
    const res = await GET()
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toEqual([
      { id: 'c1', name: 'Gaji' },
      { id: 'c2', name: 'Operasional' },
    ])
    expect(prisma.expenseCategory.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
  })
})
