import { PATCH, DELETE } from '@/app/api/expenses/[id]/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    expense: { update: jest.fn(), delete: jest.fn() },
    expenseCategory: { upsert: jest.fn() },
  },
}))

const makeReq = (body: object) =>
  new NextRequest('http://localhost/api/expenses/e1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
const makeParams = () => ({ params: Promise.resolve({ id: 'e1' }) })

describe('PATCH /api/expenses/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await PATCH(makeReq({ amount: 5000 }), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-SUPER_ADMIN', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'TUTOR' } })
    const res = await PATCH(makeReq({ amount: 5000 }), makeParams())
    expect(res.status).toBe(403)
  })

  it('returns 400 when both categoryId and categoryName are given', async () => {
    const res = await PATCH(makeReq({ categoryId: 'c1', categoryName: 'Baru' }), makeParams())
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-positive amount', async () => {
    const res = await PATCH(makeReq({ amount: -1 }), makeParams())
    expect(res.status).toBe(400)
  })

  it('updates fields without touching category when none given', async () => {
    ;(prisma.expense.update as jest.Mock).mockResolvedValue({ id: 'e1', amount: 15000 })
    const res = await PATCH(makeReq({ amount: 15000 }), makeParams())
    expect(res.status).toBe(200)
    expect(prisma.expenseCategory.upsert).not.toHaveBeenCalled()
    expect(prisma.expense.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e1' },
        data: expect.objectContaining({ amount: 15000, categoryId: undefined }),
      })
    )
  })

  it('resolves a new categoryId when categoryName is given', async () => {
    ;(prisma.expenseCategory.upsert as jest.Mock).mockResolvedValue({ id: 'c3', name: 'Transport' })
    ;(prisma.expense.update as jest.Mock).mockResolvedValue({ id: 'e1', categoryId: 'c3' })
    const res = await PATCH(makeReq({ categoryName: 'Transport' }), makeParams())
    expect(res.status).toBe(200)
    expect(prisma.expenseCategory.upsert).toHaveBeenCalledWith({
      where: { name: 'Transport' },
      update: {},
      create: { name: 'Transport' },
    })
    expect(prisma.expense.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ categoryId: 'c3' }) })
    )
  })
})

describe('DELETE /api/expenses/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(new NextRequest('http://localhost/api/expenses/e1'), makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-SUPER_ADMIN', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'PARENT' } })
    const res = await DELETE(new NextRequest('http://localhost/api/expenses/e1'), makeParams())
    expect(res.status).toBe(403)
  })

  it('deletes the expense', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
    ;(prisma.expense.delete as jest.Mock).mockResolvedValue({ id: 'e1' })
    const res = await DELETE(new NextRequest('http://localhost/api/expenses/e1'), makeParams())
    expect(res.status).toBe(200)
    expect(prisma.expense.delete).toHaveBeenCalledWith({ where: { id: 'e1' } })
  })
})
