import { GET, POST } from '@/app/api/main-programs/route'
import { PUT, DELETE } from '@/app/api/main-programs/[code]/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'

jest.mock('next-auth')
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    mainProgram: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    class: { count: jest.fn() },
  },
}))

const asRole = (role: string) => (getServerSession as jest.Mock).mockResolvedValue({ user: { role } })
const json = (url: string, method: string, body?: unknown) =>
  new Request(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }) as any
const params = (code: string) => ({ params: Promise.resolve({ code }) })

beforeEach(() => jest.clearAllMocks())

describe('GET /api/main-programs', () => {
  it('returns list for ADMIN', async () => {
    asRole('ADMIN')
    ;(prisma.mainProgram.findMany as jest.Mock).mockResolvedValue([{ code: 'SEMPOA' }])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ code: 'SEMPOA' }])
  })
  it('returns 403 for TUTOR', async () => {
    asRole('TUTOR')
    expect((await GET()).status).toBe(403)
  })
})

describe('POST /api/main-programs', () => {
  it('returns 403 for ADMIN', async () => {
    asRole('ADMIN')
    const res = await POST(json('http://localhost/api/main-programs', 'POST', { name: 'Coding' }))
    expect(res.status).toBe(403)
  })
  it('creates with code derived from name', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mainProgram.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve(data))
    const res = await POST(json('http://localhost/api/main-programs', 'POST', { name: 'Coding Kids' }))
    expect(res.status).toBe(201)
    expect(prisma.mainProgram.create).toHaveBeenCalledWith({ data: { code: 'CODING_KIDS', name: 'Coding Kids', order: 0 } })
  })
  it('returns 409 when code already exists', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue({ code: 'SEMPOA' })
    const res = await POST(json('http://localhost/api/main-programs', 'POST', { name: 'sempoa' }))
    expect(res.status).toBe(409)
    expect(prisma.mainProgram.create).not.toHaveBeenCalled()
  })
  it('returns 400 when name has no alphanumerics', async () => {
    asRole('SUPER_ADMIN')
    const res = await POST(json('http://localhost/api/main-programs', 'POST', { name: '!!!' }))
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/main-programs/[code]', () => {
  it('updates name/isActive', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue({ code: 'CODING' })
    ;(prisma.mainProgram.update as jest.Mock).mockResolvedValue({ code: 'CODING', isActive: false })
    const res = await PUT(json('http://localhost/api/main-programs/CODING', 'PUT', { isActive: false }), params('CODING'))
    expect(res.status).toBe(200)
    expect(prisma.mainProgram.update).toHaveBeenCalledWith({ where: { code: 'CODING' }, data: { isActive: false } })
  })
  it('returns 404 for unknown code', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await PUT(json('http://localhost/api/main-programs/NOPE', 'PUT', { name: 'x' }), params('NOPE'))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/main-programs/[code]', () => {
  it('returns 409 when used by classes', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue({ code: 'SEMPOA' })
    ;(prisma.class.count as jest.Mock).mockResolvedValue(2)
    const res = await DELETE(json('http://localhost/api/main-programs/SEMPOA', 'DELETE'), params('SEMPOA'))
    expect(res.status).toBe(409)
    expect(prisma.mainProgram.delete).not.toHaveBeenCalled()
  })
  it('deletes when unused', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue({ code: 'CODING' })
    ;(prisma.class.count as jest.Mock).mockResolvedValue(0)
    const res = await DELETE(json('http://localhost/api/main-programs/CODING', 'DELETE'), params('CODING'))
    expect(res.status).toBe(200)
    expect(prisma.mainProgram.delete).toHaveBeenCalledWith({ where: { code: 'CODING' } })
  })
})

describe('race errors map to 409', () => {
  it('POST returns 409 on P2002', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.mainProgram.create as jest.Mock).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    )
    const res = await POST(json('http://localhost/api/main-programs', 'POST', { name: 'Coding' }))
    expect(res.status).toBe(409)
  })
  it('DELETE returns 409 on P2003', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue({ code: 'CODING' })
    ;(prisma.class.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.mainProgram.delete as jest.Mock).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'x' }),
    )
    const res = await DELETE(json('http://localhost/api/main-programs/CODING', 'DELETE'), params('CODING'))
    expect(res.status).toBe(409)
  })
})
