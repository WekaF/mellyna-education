import { PATCH } from '@/app/api/admin/users/[id]/suspend/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const req = () => new NextRequest('http://localhost/api/admin/users/u1/suspend', { method: 'PATCH' })
const params = { params: Promise.resolve({ id: 'u1' }) }

describe('PATCH /api/admin/users/[id]/suspend', () => {
  beforeEach(() => jest.clearAllMocks())

  it('ADMIN tidak boleh tangguhkan ADMIN lain', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'ADMIN', suspended: false })
    const res = await PATCH(req(), params)
    expect(res.status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('SUPER_ADMIN boleh tangguhkan ADMIN', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 's1', role: 'SUPER_ADMIN' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'ADMIN', suspended: false })
    const tx = {
      user: { update: jest.fn().mockResolvedValue({ id: 'u1', suspended: true, role: 'ADMIN' }) },
      student: { updateMany: jest.fn() },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(tx))
    const res = await PATCH(req(), params)
    expect(res.status).toBe(200)
    expect((await res.json()).suspended).toBe(true)
    expect(tx.student.updateMany).not.toHaveBeenCalled()
  })

  it('SUPER_ADMIN tetap tidak bisa ditangguhkan', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 's1', role: 'SUPER_ADMIN' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'SUPER_ADMIN', suspended: false })
    const res = await PATCH(req(), params)
    expect(res.status).toBe(403)
  })

  it('ADMIN tetap boleh tangguhkan PARENT, siswanya ikut nonaktif', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'PARENT', suspended: false })
    const tx = {
      user: { update: jest.fn().mockResolvedValue({ id: 'u1', suspended: true, role: 'PARENT' }) },
      student: { updateMany: jest.fn() },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(tx))
    const res = await PATCH(req(), params)
    expect(res.status).toBe(200)
    expect(tx.student.updateMany).toHaveBeenCalledWith({ where: { parentId: 'u1' }, data: { isActive: false } })
  })
})
