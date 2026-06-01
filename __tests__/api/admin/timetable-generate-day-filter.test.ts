import { POST } from '@/app/api/admin/timetable/generate/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

jest.mock('next-auth')
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/waha', () => ({
  getSessionStatus: jest.fn().mockResolvedValue('STOPPED'),
  sendWhatsApp: jest.fn(),
  sleep: jest.fn(),
  randomDelay: jest.fn().mockReturnValue(0),
}))
jest.mock('@/lib/db', () => ({
  prisma: {
    class: { findMany: jest.fn() },
    schedule: { findFirst: jest.fn(), create: jest.fn() },
  },
}))

const mockSession = { user: { role: 'SUPER_ADMIN' } }

function makeClass(dayOfWeek: string, id: string) {
  return {
    id,
    name: `Kelas ${id}`,
    dayOfWeek,
    timeSlot: '08:00',
    tutor: { name: 'Budi', phone: null },
    additionalTutors: [],
    programs: [{ program: 'SEMPOA' }],
    enrollments: [],
  }
}

describe('POST /api/admin/timetable/generate - day filter', () => {
  beforeEach(() => jest.clearAllMocks())

  it('only generates classes for selectedDays', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.class.findMany as jest.Mock).mockResolvedValue([makeClass('MONDAY', 'c1')])
    ;(prisma.schedule.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.schedule.create as jest.Mock).mockResolvedValue({
      id: 's1', date: new Date('2026-06-01'), participants: [],
    })

    const req = new Request('http://localhost/api/admin/timetable/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-06-01', selectedDays: ['MONDAY'] }),
    })
    const res = await POST(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.created).toBe(1)

    // Verify findMany was called with dayOfWeek filter containing only MONDAY
    const findManyCall = (prisma.class.findMany as jest.Mock).mock.calls[0][0]
    expect(findManyCall.where.dayOfWeek).toEqual({ not: null, in: ['MONDAY'] })
  })

  it('generates all days when selectedDays not provided (backward compat)', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.class.findMany as jest.Mock).mockResolvedValue([])

    const req = new Request('http://localhost/api/admin/timetable/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-06-01' }),
    })
    await POST(req as any)

    const findManyCall = (prisma.class.findMany as jest.Mock).mock.calls[0][0]
    expect(findManyCall.where.dayOfWeek.in).toHaveLength(7)
  })
})
