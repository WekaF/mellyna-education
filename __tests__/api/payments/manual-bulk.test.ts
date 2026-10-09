import { POST } from '@/app/api/payments/manual/bulk/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    invoice: { findMany: jest.fn(), updateMany: jest.fn() },
    payment: { createMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

const makeReq = (body: object) =>
  new NextRequest('http://localhost/api/payments/manual/bulk', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

describe('POST /api/payments/manual/bulk', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } })
    // interactive transaction: jalankan callback dengan mock prisma sebagai tx
    ;(prisma.$transaction as jest.Mock).mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma))
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ invoiceIds: ['a'], method: 'CASH' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when role is PARENT', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'PARENT' } })
    const res = await POST(makeReq({ invoiceIds: ['a'], method: 'CASH' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 for empty invoiceIds', async () => {
    const res = await POST(makeReq({ invoiceIds: [], method: 'CASH' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for more than 500 invoiceIds', async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `id${i}`)
    const res = await POST(makeReq({ invoiceIds: ids, method: 'CASH' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid method', async () => {
    const res = await POST(makeReq({ invoiceIds: ['a'], method: 'GOPAY' }))
    expect(res.status).toBe(400)
  })

  it('marks only payable invoices PAID and creates one payment each', async () => {
    ;(prisma.invoice.findMany as jest.Mock).mockResolvedValue([
      { id: 'a', amount: 100000 },
      { id: 'b', amount: 250000 },
    ])
    ;(prisma.invoice.updateMany as jest.Mock).mockResolvedValue({ count: 2 })
    ;(prisma.payment.createMany as jest.Mock).mockResolvedValue({ count: 2 })

    // 'a' dikirim dua kali → harus di-dedupe; 'c' sudah PAID → tidak dikembalikan findMany
    const res = await POST(makeReq({ invoiceIds: ['a', 'a', 'b', 'c'], method: 'BRI_TRANSFER', notes: 'Rekap Oktober' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ updated: 2, skipped: 1 })

    const findArgs = (prisma.invoice.findMany as jest.Mock).mock.calls[0][0]
    expect(findArgs.where).toEqual({ id: { in: ['a', 'b', 'c'] }, status: { in: ['PENDING', 'OVERDUE'] } })

    const updateArgs = (prisma.invoice.updateMany as jest.Mock).mock.calls[0][0]
    expect(updateArgs.where).toEqual({ id: { in: ['a', 'b'] }, status: { in: ['PENDING', 'OVERDUE'] } })
    expect(updateArgs.data.status).toBe('PAID')

    const payData = (prisma.payment.createMany as jest.Mock).mock.calls[0][0].data
    expect(payData).toHaveLength(2)
    expect(payData[0]).toMatchObject({
      invoiceId: 'a',
      amount: 100000,
      method: 'BRI_TRANSFER',
      status: 'SUCCESS',
      midtransData: { notes: 'Rekap Oktober' },
    })
    expect(payData[1]).toMatchObject({ invoiceId: 'b', amount: 250000 })
  })

  it('returns updated 0 without writing when nothing is payable', async () => {
    ;(prisma.invoice.findMany as jest.Mock).mockResolvedValue([])
    const res = await POST(makeReq({ invoiceIds: ['c'], method: 'CASH' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ updated: 0, skipped: 1 })
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled()
    expect(prisma.payment.createMany).not.toHaveBeenCalled()
  })

  it('returns 409 and creates no payment when an invoice changed status mid-transaction', async () => {
    ;(prisma.invoice.findMany as jest.Mock).mockResolvedValue([
      { id: 'a', amount: 100000 },
      { id: 'b', amount: 250000 },
    ])
    // 'b' keburu lunas via webhook → hanya 1 ter-update
    ;(prisma.invoice.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    const res = await POST(makeReq({ invoiceIds: ['a', 'b'], method: 'CASH' }))
    expect(res.status).toBe(409)
    expect(prisma.payment.createMany).not.toHaveBeenCalled()
  })

  it('returns 500 when transaction fails unexpectedly', async () => {
    ;(prisma.$transaction as jest.Mock).mockRejectedValue(new Error('db down'))
    const res = await POST(makeReq({ invoiceIds: ['a'], method: 'CASH' }))
    expect(res.status).toBe(500)
  })
})
