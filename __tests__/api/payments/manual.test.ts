import { POST } from '@/app/api/payments/manual/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    invoice: { findUnique: jest.fn(), update: jest.fn() },
    payment: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

const makeReq = (body: object) =>
  new NextRequest('http://localhost/api/payments/manual', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

describe('POST /api/payments/manual', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ invoiceId: 'x', method: 'CASH' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when role is PARENT', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'PARENT' } })
    const res = await POST(makeReq({ invoiceId: 'x', method: 'CASH' }))
    expect(res.status).toBe(403)
  })

  it('returns 404 when invoice not found', async () => {
    ;(prisma.invoice.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ invoiceId: 'notexist', method: 'CASH' }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when invoice already PAID', async () => {
    ;(prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ id: 'x', amount: 500000, status: 'PAID' })
    const res = await POST(makeReq({ invoiceId: 'x', method: 'CASH' }))
    expect(res.status).toBe(400)
  })

  it('marks invoice as PAID on success', async () => {
    ;(prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ id: 'x', amount: 500000, status: 'PENDING' })
    ;(prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}])
    const res = await POST(makeReq({ invoiceId: 'x', method: 'CASH', notes: 'Bayar di tempat' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
