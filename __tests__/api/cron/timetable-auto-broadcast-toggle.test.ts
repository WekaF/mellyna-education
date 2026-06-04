import { GET } from '@/app/api/cron/timetable-generate/route'
import { prisma } from '@/lib/db'
import * as waha from '@/lib/waha'

jest.mock('@/lib/waha', () => ({
  sendWhatsApp: jest.fn(),
  sleep: jest.fn(),
  randomDelay: jest.fn().mockReturnValue(0),
}))
jest.mock('@/lib/db', () => ({
  prisma: {
    class: { findMany: jest.fn() },
    schedule: { findFirst: jest.fn(), create: jest.fn() },
    systemSetting: { findFirst: jest.fn() },
  },
}))

const CRON_SECRET = 'change-this-to-random-secret'
const cronUrl = `http://localhost/api/cron/timetable-generate?secret=${CRON_SECRET}`

function makeClass(id: string) {
  return {
    id,
    name: `Kelas ${id}`,
    dayOfWeek: 'MONDAY',
    timeSlot: '08:00',
    tutor: { name: 'Budi', phone: '6281234567890' },
    additionalTutors: [],
    programs: [{ program: 'SEMPOA' }],
    enrollments: [
      {
        studentId: 'st1',
        student: {
          name: 'Siswa 1',
          parent: { name: 'Ayah 1', phone: '6289999999999' },
        },
      },
    ],
  }
}

describe('GET /api/cron/timetable-generate - auto-broadcast toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.class.findMany as jest.Mock).mockResolvedValue([makeClass('c1')])
    ;(prisma.schedule.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.schedule.create as jest.Mock).mockResolvedValue({
      id: 's1', date: new Date(), participants: [
        { student: { name: 'Siswa 1', parent: { name: 'Ayah 1', phone: '6289999999999' } } }
      ],
    })
  })

  it('sends WA when AUTO_TIMETABLE_BROADCAST is true', async () => {
    ;(prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue({
      key: 'AUTO_TIMETABLE_BROADCAST', value: 'true',
    })

    const req = new Request(cronUrl)
    await GET(req as any)

    // Allow fire-and-forget to run
    for (let i = 0; i < 20; i++) await Promise.resolve()
    expect(waha.sendWhatsApp).toHaveBeenCalled()
  })

  it('skips WA when AUTO_TIMETABLE_BROADCAST is false', async () => {
    ;(prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue({
      key: 'AUTO_TIMETABLE_BROADCAST', value: 'false',
    })

    const req = new Request(cronUrl)
    await GET(req as any)

    for (let i = 0; i < 20; i++) await Promise.resolve()
    expect(waha.sendWhatsApp).not.toHaveBeenCalled()
  })

  it('sends WA when AUTO_TIMETABLE_BROADCAST setting is absent (default true)', async () => {
    ;(prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue(null)

    const req = new Request(cronUrl)
    await GET(req as any)

    for (let i = 0; i < 20; i++) await Promise.resolve()
    expect(waha.sendWhatsApp).toHaveBeenCalled()
  })
})
