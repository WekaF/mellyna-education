import { PUT, DELETE } from '@/app/api/users/[id]/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('bcryptjs', () => ({ __esModule: true, default: { hash: jest.fn().mockResolvedValue('hashed-pw') } }))
jest.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const asRole = (role: string, id = 'actor') =>
  (getServerSession as jest.Mock).mockResolvedValue({ user: { id, role } })
const target = (role: string) =>
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role, children: [] })

const putReq = (body: object) =>
  new NextRequest('http://localhost/api/users/u1', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
const delReq = () => new NextRequest('http://localhost/api/users/u1', { method: 'DELETE' })
const params = { params: Promise.resolve({ id: 'u1' }) }

describe('PUT /api/users/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('ADMIN tidak boleh ganti password SUPER_ADMIN', async () => {
    asRole('ADMIN')
    target('SUPER_ADMIN')
    const res = await PUT(putReq({ password: 'newpass123' }), params)
    expect(res.status).toBe(403)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('ADMIN tidak boleh edit ADMIN lain', async () => {
    asRole('ADMIN')
    target('ADMIN')
    const res = await PUT(putReq({ name: 'X' }), params)
    expect(res.status).toBe(403)
  })

  it('ADMIN tetap boleh edit TUTOR', async () => {
    asRole('ADMIN')
    target('TUTOR')
    ;(prisma.user.update as jest.Mock).mockResolvedValue({ id: 'u1', name: 'Budi' })
    const res = await PUT(putReq({ name: 'Budi' }), params)
    expect(res.status).toBe(200)
  })

  it('SUPER_ADMIN boleh ganti password ADMIN, password di-hash', async () => {
    asRole('SUPER_ADMIN')
    target('ADMIN')
    ;(prisma.user.update as jest.Mock).mockResolvedValue({ id: 'u1' })
    const res = await PUT(putReq({ password: 'newpass123' }), params)
    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { password: 'hashed-pw' } })
    )
  })

  it('password hanya spasi ditolak 400, tidak di-update', async () => {
    asRole('SUPER_ADMIN')
    target('ADMIN')
    const res = await PUT(putReq({ password: '      ' }), params)
    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('404 kalau user tidak ada', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await PUT(putReq({ name: 'X' }), params)
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/users/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('ADMIN tidak boleh hapus ADMIN', async () => {
    asRole('ADMIN')
    target('ADMIN')
    const res = await DELETE(delReq(), params)
    expect(res.status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('SUPER_ADMIN tidak bisa dihapus', async () => {
    asRole('SUPER_ADMIN')
    target('SUPER_ADMIN')
    const res = await DELETE(delReq(), params)
    expect(res.status).toBe(400)
  })

  it('SUPER_ADMIN boleh hapus ADMIN', async () => {
    asRole('SUPER_ADMIN')
    target('ADMIN')
    const tx = { user: { delete: jest.fn() } }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(tx))
    const res = await DELETE(delReq(), params)
    expect(res.status).toBe(200)
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } })
  })

  it('FK violation (tutor punya kelas/laporan) → 409 dengan saran tangguhkan', async () => {
    asRole('SUPER_ADMIN')
    target('TUTOR')
    ;(prisma.$transaction as jest.Mock).mockRejectedValue({ code: 'P2003', message: 'fk' })
    const res = await DELETE(delReq(), params)
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toMatch(/Tangguhkan/)
  })

  it('ADMIN tetap boleh hapus PARENT beserta data anak', async () => {
    asRole('ADMIN')
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'PARENT', children: [{ id: 's1' }] })
    const tx = {
      invoice: { findMany: jest.fn().mockResolvedValue([{ id: 'i1' }]), deleteMany: jest.fn() },
      payment: { deleteMany: jest.fn() },
      attendance: { deleteMany: jest.fn() },
      enrollment: { deleteMany: jest.fn() },
      learningReport: { deleteMany: jest.fn() },
      student: { deleteMany: jest.fn() },
      user: { delete: jest.fn() },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(tx))
    const res = await DELETE(delReq(), params)
    expect(res.status).toBe(200)
    expect(tx.student.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['s1'] } } })
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } })
  })
})
