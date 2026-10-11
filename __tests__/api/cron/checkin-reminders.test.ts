import { GET } from '@/app/api/cron/checkin-reminders/route'
import { prisma } from '@/lib/db'
import * as waha from '@/lib/waha'
import { isCheckInReminderDue } from '@/lib/checkin-policy'
import { NextRequest } from 'next/server'

jest.mock('@/lib/waha', () => ({
  sendWhatsApp: jest.fn().mockResolvedValue(true),
  sleep: jest.fn(),
  randomDelay: jest.fn().mockReturnValue(0),
}))
jest.mock('@/lib/db', () => ({
  prisma: {
    schedule: { findMany: jest.fn(), updateMany: jest.fn() },
  },
}))

const SECRET = 'test-cron-secret'
process.env.N8N_WEBHOOK_SECRET = SECRET

const call = (secret = SECRET) =>
  GET(new NextRequest(`http://localhost/api/cron/checkin-reminders?secret=${secret}`))

// Jadwal yang mulai 10 menit lagi → jendela absen sudah buka, sesi belum mulai.
function dueSchedule(over: Record<string, unknown> = {}) {
  const startsAt = new Date(Date.now() + 10 * 60 * 1000)
  const wib = new Date(startsAt.getTime() + 7 * 60 * 60 * 1000)
  return {
    id: 's1',
    date: new Date(`${wib.toISOString().slice(0, 10)}T00:00:00Z`),
    startTime: wib.toISOString().slice(11, 16),
    endTime: '23:59',
    class: {
      name: 'Sempoa A',
      tutor: { id: 't1', name: 'Budi', phone: '6281111111111' },
      additionalTutors: [],
    },
    tutorCheckIns: [],
    ...over,
  }
}

describe('isCheckInReminderDue', () => {
  const date = new Date('2026-10-20') // sesi 15:00 WIB = 08:00Z, absen buka 07:30Z

  it('is not due before check-in opens', () => {
    expect(isCheckInReminderDue(date, '15:00', new Date('2026-10-20T07:29:59Z'))).toBe(false)
  })

  it('is due from opening until the session starts', () => {
    expect(isCheckInReminderDue(date, '15:00', new Date('2026-10-20T07:30:00Z'))).toBe(true)
    expect(isCheckInReminderDue(date, '15:00', new Date('2026-10-20T08:00:00Z'))).toBe(true)
  })

  it('is not due once the session has started', () => {
    expect(isCheckInReminderDue(date, '15:00', new Date('2026-10-20T08:00:01Z'))).toBe(false)
  })
})

describe('GET /api/cron/checkin-reminders', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.schedule.findMany as jest.Mock).mockResolvedValue([dueSchedule()])
    ;(prisma.schedule.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
  })

  it('returns 401 without a valid secret', async () => {
    const res = await call('wrong')
    expect(res.status).toBe(401)
    expect(prisma.schedule.findMany).not.toHaveBeenCalled()
  })

  it('only looks at published schedules that were not reminded yet', async () => {
    await call()
    expect(prisma.schedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PUBLISHED', checkInReminderSentAt: null }),
      }),
    )
  })

  it('reminds the tutor who has not checked in', async () => {
    const res = await call()
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toMatchObject({ success: true, schedules: 1, sent: 1 })
    expect(waha.sendWhatsApp).toHaveBeenCalledTimes(1)
    const [phone, message] = (waha.sendWhatsApp as jest.Mock).mock.calls[0]
    expect(phone).toBe('6281111111111')
    expect(message).toContain('Budi')
    expect(message).toContain('Sempoa A')
  })

  it('does not remind a tutor who already checked in', async () => {
    ;(prisma.schedule.findMany as jest.Mock).mockResolvedValue([
      dueSchedule({ tutorCheckIns: [{ tutorId: 't1' }] }),
    ])
    const data = await (await call()).json()
    expect(data.sent).toBe(0)
    expect(waha.sendWhatsApp).not.toHaveBeenCalled()
  })

  it('reminds additional tutors too, and skips tutors without a phone', async () => {
    ;(prisma.schedule.findMany as jest.Mock).mockResolvedValue([
      dueSchedule({
        class: {
          name: 'Sempoa A',
          tutor: { id: 't1', name: 'Budi', phone: null },
          additionalTutors: [{ tutor: { id: 't2', name: 'Sari', phone: '6282222222222' } }],
        },
      }),
    ])
    await call()
    expect(waha.sendWhatsApp).toHaveBeenCalledTimes(1)
    expect((waha.sendWhatsApp as jest.Mock).mock.calls[0][0]).toBe('6282222222222')
  })

  it('skips schedules whose check-in window is not open yet', async () => {
    const startsAt = new Date(Date.now() + 3 * 60 * 60 * 1000)
    const wib = new Date(startsAt.getTime() + 7 * 60 * 60 * 1000)
    ;(prisma.schedule.findMany as jest.Mock).mockResolvedValue([
      dueSchedule({
        date: new Date(`${wib.toISOString().slice(0, 10)}T00:00:00Z`),
        startTime: wib.toISOString().slice(11, 16),
      }),
    ])
    const data = await (await call()).json()
    expect(data).toMatchObject({ schedules: 0, sent: 0 })
    expect(prisma.schedule.updateMany).not.toHaveBeenCalled()
    expect(waha.sendWhatsApp).not.toHaveBeenCalled()
  })

  it('marks the schedule as reminded before sending, and sends nothing if another run claimed it', async () => {
    ;(prisma.schedule.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    const data = await (await call()).json()
    expect(prisma.schedule.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', checkInReminderSentAt: null },
      data: { checkInReminderSentAt: expect.any(Date) },
    })
    expect(data.sent).toBe(0)
    expect(waha.sendWhatsApp).not.toHaveBeenCalled()
  })
})
