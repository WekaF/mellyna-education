// Test that Wednesday input gets normalized to Monday of that week
import { POST } from '@/app/api/admin/timetable/generate/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import * as waha from '@/lib/waha'

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

describe('POST /api/admin/timetable/generate - any day input', () => {
  it('accepts a Wednesday and creates Monday-class schedule on correct Monday', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
    ;(prisma.class.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'c1',
        name: 'Kelas A',
        dayOfWeek: 'MONDAY',
        timeSlot: '08:00',
        tutor: { name: 'Budi', phone: null },
        additionalTutors: [],
        programs: [{ program: 'SEMPOA' }],
        enrollments: [],
      },
    ])
    ;(prisma.schedule.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.schedule.create as jest.Mock).mockResolvedValue({
      id: 's1',
      date: new Date('2026-06-01'), // Monday
      participants: [],
    })

    // Input: Wednesday 2026-06-03
    const req = new Request('http://localhost/api/admin/timetable/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-06-03' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)

    // Verify schedule.create was called with date = 2026-06-01 (Monday of that week)
    const createCall = (prisma.schedule.create as jest.Mock).mock.calls[0][0]
    const createdDate: Date = createCall.data.date
    expect(createdDate.toISOString().split('T')[0]).toBe('2026-06-01')
  })
})
