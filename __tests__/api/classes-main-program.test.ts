import { POST } from '@/app/api/classes/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

jest.mock('next-auth')
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    mainProgram: { findUnique: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const mockTx = {
  class: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
  classTutor: { createMany: jest.fn() },
}

const post = (body: unknown) =>
  POST(new Request('http://localhost/api/classes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any)

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } })
  ;(prisma.$transaction as jest.Mock).mockImplementation((fn: (tx: typeof mockTx) => unknown) => fn(mockTx))
  mockTx.class.create.mockResolvedValue({ id: 'c1' })
  mockTx.class.findUniqueOrThrow.mockResolvedValue({ id: 'c1' })
})

describe('POST /api/classes main program', () => {
  it('accepts custom main program with no sub-programs', async () => {
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue({ code: 'CODING' })
    const res = await post({ name: 'Coding A', mainProgram: 'CODING', programs: [], tutorId: 't1' })
    expect(res.status).toBe(201)
    expect(mockTx.class.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ mainProgram: 'CODING', programs: { create: [] } }),
    })
  })

  it('rejects unknown main program', async () => {
    ;(prisma.mainProgram.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await post({ name: 'X', mainProgram: 'NOPE', programs: [], tutorId: 't1' })
    expect(res.status).toBe(400)
    expect(mockTx.class.create).not.toHaveBeenCalled()
  })

  it('falls back to first sub-program registered as main program', async () => {
    ;(prisma.mainProgram.findMany as jest.Mock).mockResolvedValue([{ code: 'SEMPOA' }])
    const res = await post({ name: 'S', mainProgram: null, programs: ['AHE', 'SEMPOA'], tutorId: 't1' })
    expect(res.status).toBe(201)
    expect(mockTx.class.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ mainProgram: 'SEMPOA' }),
    })
  })

  it('rejects when neither main program nor programs given', async () => {
    const res = await post({ name: 'S', programs: [], tutorId: 't1' })
    expect(res.status).toBe(400)
  })
})
