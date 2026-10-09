import { PUT } from '@/app/api/classes/[id]/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

jest.mock('next-auth')
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    class: { findUnique: jest.fn() },
    mainProgram: { findUnique: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const mockTx = {
  classProgram: { deleteMany: jest.fn(), createMany: jest.fn() },
  classTutor: { deleteMany: jest.fn(), createMany: jest.fn() },
  class: { update: jest.fn() },
}

const put = (body: unknown) =>
  PUT(
    new Request('http://localhost/api/classes/c1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as any,
    { params: Promise.resolve({ id: 'c1' }) }
  )

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } })
  ;(prisma.$transaction as jest.Mock).mockImplementation((fn: (tx: typeof mockTx) => unknown) => fn(mockTx))
  mockTx.class.update.mockResolvedValue({ id: 'c1' })
})

describe('PUT /api/classes/[id] main program', () => {
  it('re-adds enum main program when programs is empty', async () => {
    ;(prisma.class.findUnique as jest.Mock).mockResolvedValue({ mainProgram: 'SEMPOA' })
    const res = await put({ programs: [] })
    expect(res.status).toBe(200)
    expect(mockTx.classProgram.createMany).toHaveBeenCalledWith({ data: [{ classId: 'c1', program: 'SEMPOA' }] })
  })

  it('leaves ClassProgram empty for custom main program', async () => {
    ;(prisma.class.findUnique as jest.Mock).mockResolvedValue({ mainProgram: 'CODING_KIDS' })
    const res = await put({ programs: [] })
    expect(res.status).toBe(200)
    expect(mockTx.classProgram.deleteMany).toHaveBeenCalled()
    expect(mockTx.classProgram.createMany).toHaveBeenCalledWith({ data: [] })
  })

  it('400 when no main program and no programs', async () => {
    ;(prisma.class.findUnique as jest.Mock).mockResolvedValue({ mainProgram: null })
    const res = await put({ programs: [] })
    expect(res.status).toBe(400)
  })

  it('404 when class missing', async () => {
    ;(prisma.class.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await put({ programs: ['EFK'] })
    expect(res.status).toBe(404)
  })

  it('includes requested enum main program plus given programs', async () => {
    ;(prisma.class.findUnique as jest.Mock).mockResolvedValue({ mainProgram: 'SEMPOA' })
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue({ code: 'ENGLISH' })
    const res = await put({ mainProgram: 'ENGLISH', programs: ['EFK'] })
    expect(res.status).toBe(200)
    const data = mockTx.classProgram.createMany.mock.calls[0][0].data
    expect(data).toEqual([
      { classId: 'c1', program: 'ENGLISH' },
      { classId: 'c1', program: 'EFK' },
    ])
  })
})
