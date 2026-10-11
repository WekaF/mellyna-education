import { POST } from '@/app/api/tutor-checkin/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'
import { checkInWindow } from '@/lib/checkin-policy'
import { CHECKIN_CENTER } from '@/lib/geolocation'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    schedule: { findFirst: jest.fn() },
    tutorCheckIn: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}))
jest.mock('@/lib/checkin-policy', () => ({
  ...jest.requireActual('@/lib/checkin-policy'),
  checkInWindow: jest.fn(),
}))

const makeReq = (body: object) =>
  new NextRequest('http://localhost/api/tutor-checkin', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

const inside = { latitude: CHECKIN_CENTER.lat, longitude: CHECKIN_CENTER.lng }
const outside = { latitude: -7.035736, longitude: 113.558258 }
const schedule = { id: 's1', date: new Date('2026-10-20'), startTime: '15:00' }

describe('POST /api/tutor-checkin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 't1', role: 'TUTOR' } })
    ;(prisma.schedule.findFirst as jest.Mock).mockResolvedValue(schedule)
    ;(prisma.tutorCheckIn.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.tutorCheckIn.upsert as jest.Mock).mockImplementation(async ({ create }) => ({
      ...create,
      checkedInAt: new Date('2026-10-20T07:45:00Z'),
    }))
    ;(checkInWindow as jest.Mock).mockReturnValue('open')
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    expect((await POST(makeReq({ scheduleId: 's1', ...inside }))).status).toBe(401)
  })

  it('returns 403 for non-tutor', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } })
    expect((await POST(makeReq({ scheduleId: 's1', ...inside }))).status).toBe(403)
  })

  it('returns 400 when scheduleId is missing', async () => {
    expect((await POST(makeReq(inside))).status).toBe(400)
  })

  it('returns 404 when the schedule is not one of the tutor’s published schedules', async () => {
    ;(prisma.schedule.findFirst as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ scheduleId: 's1', ...inside }))
    expect(res.status).toBe(404)
    expect(prisma.schedule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 's1',
          OR: [
            { class: { tutorId: 't1' } },
            { class: { additionalTutors: { some: { tutorId: 't1' } } } },
          ],
        }),
      }),
    )
  })

  it.each(['not-open', 'closed'])('returns 422 and writes nothing when window is %s', async (window) => {
    ;(checkInWindow as jest.Mock).mockReturnValue(window)
    const res = await POST(makeReq({ scheduleId: 's1', ...inside }))
    expect(res.status).toBe(422)
    expect(prisma.tutorCheckIn.upsert).not.toHaveBeenCalled()
  })

  it('creates a check-in tied to the schedule and its WIB day', async () => {
    const res = await POST(makeReq({ scheduleId: 's1', ...inside }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toMatchObject({ success: true, isWithinRadius: true, scheduleId: 's1', late: false })
    expect(prisma.tutorCheckIn.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tutorId_scheduleId: { tutorId: 't1', scheduleId: 's1' } },
        create: expect.objectContaining({ tutorId: 't1', scheduleId: 's1', date: '2026-10-20', isWithinRadius: true }),
      }),
    )
  })

  it('returns 422 with isWithinRadius false when outside the radius', async () => {
    const res = await POST(makeReq({ scheduleId: 's1', ...outside }))
    const data = await res.json()
    expect(res.status).toBe(422)
    expect(data.isWithinRadius).toBe(false)
  })

  it('does not overwrite an existing valid check-in', async () => {
    ;(prisma.tutorCheckIn.findUnique as jest.Mock).mockResolvedValue({
      isWithinRadius: true,
      distanceM: 12.4,
      checkedInAt: new Date('2026-10-20T07:40:00Z'),
    })
    const res = await POST(makeReq({ scheduleId: 's1', ...outside }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toMatchObject({ success: true, isWithinRadius: true, distanceM: 12 })
    expect(prisma.tutorCheckIn.upsert).not.toHaveBeenCalled()
  })

  it('accepts a nearby point when the reported GPS accuracy covers the gap', async () => {
    const near = { latitude: CHECKIN_CENTER.lat + 0.0002, longitude: CHECKIN_CENTER.lng } // ≈ 22 m
    expect((await POST(makeReq({ scheduleId: 's1', ...near }))).status).toBe(422)
    const res = await POST(makeReq({ scheduleId: 's1', ...near, accuracy: 20 }))
    expect(res.status).toBe(200)
    expect(prisma.tutorCheckIn.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ accuracyM: 20, isWithinRadius: true }) }),
    )
  })
})
