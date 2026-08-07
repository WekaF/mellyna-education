import { GET, POST } from '@/app/api/expenses/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    expense: { findMany: jest.fn(), create: jest.fn() },
    expenseCategory: { upsert: jest.fn() },
  },
}))

const makeGetReq = (qs = '') => new NextRequest(`http://localhost/api/expenses${qs}`)
const makePostReq = (body: object) =>
  new NextRequest('http://localhost/api/expenses', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

describe('GET /api/expenses', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeGetReq())
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-SUPER_ADMIN', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'PARENT' } })
    const res = await GET(makeGetReq())
    expect(res.status).toBe(403)
  })

  it('filters by month/year using the date field', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
    ;(prisma.expense.findMany as jest.Mock).mockResolvedValue([])
    await GET(makeGetReq('?month=8&year=2026'))
    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { date: { gte: new Date(2026, 7, 1), lt: new Date(2026, 8, 1) } },
      })
    )
  })

  it('filters by year only when month is absent', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
    ;(prisma.expense.findMany as jest.Mock).mockResolvedValue([])
    await GET(makeGetReq('?year=2026'))
    expect(prisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { date: { gte: new Date(2026, 0, 1), lt: new Date(2027, 0, 1) } },
      })
    )
  })

  it('returns all expenses when no filter given', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
    ;(prisma.expense.findMany as jest.Mock).mockResolvedValue([])
    await GET(makeGetReq())
    expect(prisma.expense.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })
})

describe('POST /api/expenses', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', role: 'SUPER_ADMIN' } })
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await POST(makePostReq({ date: '2026-08-01', amount: 10000, description: 'Test', categoryId: 'c1' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-SUPER_ADMIN', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'TUTOR' } })
    const res = await POST(makePostReq({ date: '2026-08-01', amount: 10000, description: 'Test', categoryId: 'c1' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when both categoryId and categoryName are given', async () => {
    const res = await POST(
      makePostReq({ date: '2026-08-01', amount: 10000, description: 'Test', categoryId: 'c1', categoryName: 'Baru' })
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 when neither categoryId nor categoryName is given', async () => {
    const res = await POST(makePostReq({ date: '2026-08-01', amount: 10000, description: 'Test' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-positive amount', async () => {
    const res = await POST(makePostReq({ date: '2026-08-01', amount: 0, description: 'Test', categoryId: 'c1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty description', async () => {
    const res = await POST(makePostReq({ date: '2026-08-01', amount: 10000, description: '', categoryId: 'c1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for malformed JSON body', async () => {
    const badReq = new NextRequest('http://localhost/api/expenses', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(badReq)
    expect(res.status).toBe(400)
  })

  it('creates an expense using an existing categoryId', async () => {
    ;(prisma.expense.create as jest.Mock).mockResolvedValue({ id: 'e1', amount: 10000, categoryId: 'c1' })
    const res = await POST(makePostReq({ date: '2026-08-01', amount: 10000, description: 'Test', categoryId: 'c1' }))
    expect(res.status).toBe(201)
    expect(prisma.expenseCategory.upsert).not.toHaveBeenCalled()
    expect(prisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ categoryId: 'c1', amount: 10000, description: 'Test', createdById: 'u1' }),
      })
    )
  })

  it('auto-creates the category when categoryName is given', async () => {
    ;(prisma.expenseCategory.upsert as jest.Mock).mockResolvedValue({ id: 'c2', name: 'Sewa' })
    ;(prisma.expense.create as jest.Mock).mockResolvedValue({ id: 'e2', amount: 20000, categoryId: 'c2' })
    const res = await POST(makePostReq({ date: '2026-08-01', amount: 20000, description: 'Sewa gedung', categoryName: 'Sewa' }))
    expect(res.status).toBe(201)
    expect(prisma.expenseCategory.upsert).toHaveBeenCalledWith({
      where: { name: 'Sewa' },
      update: {},
      create: { name: 'Sewa' },
    })
    expect(prisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ categoryId: 'c2' }) })
    )
  })
})
