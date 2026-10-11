import { GET, PUT } from '@/app/api/admin/settings/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

jest.mock('next-auth')
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    systemSetting: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

const mockSession = { user: { role: 'SUPER_ADMIN' } }

describe('GET /api/admin/settings', () => {
  it('returns defaults when no settings in DB', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([])

    const req = new Request('http://localhost/api/admin/settings')
    const res = await GET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.AUTO_TIMETABLE_BROADCAST).toBe('true')
  })

  it('returns DB value when setting exists', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([
      { key: 'AUTO_TIMETABLE_BROADCAST', value: 'false', updatedAt: new Date() },
    ])

    const req = new Request('http://localhost/api/admin/settings')
    const res = await GET(req as any)
    const data = await res.json()

    expect(data.AUTO_TIMETABLE_BROADCAST).toBe('false')
  })

  it('returns 403 for non-admin', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'TUTOR' } })
    const req = new Request('http://localhost/api/admin/settings')
    const res = await GET(req as any)
    expect(res.status).toBe(403)
  })
})

describe('PUT /api/admin/settings', () => {
  it('upserts setting and returns it', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.systemSetting.upsert as jest.Mock).mockResolvedValue({
      key: 'AUTO_TIMETABLE_BROADCAST', value: 'false', updatedAt: new Date(),
    })

    const req = new Request('http://localhost/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'AUTO_TIMETABLE_BROADCAST', value: 'false' }),
    })
    const res = await PUT(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.key).toBe('AUTO_TIMETABLE_BROADCAST')
    expect(data.value).toBe('false')
  })

  it('returns 400 when key or value missing', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)

    const req = new Request('http://localhost/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'AUTO_TIMETABLE_BROADCAST' }),
    })
    const res = await PUT(req as any)
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/admin/settings — CHECKIN_RADIUS_METERS', () => {
  const put = (value: string) =>
    PUT(
      new Request('http://localhost/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'CHECKIN_RADIUS_METERS', value }),
      }) as any,
    )

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.systemSetting.upsert as jest.Mock).mockImplementation(async ({ create }) => create)
  })

  it.each(['4', '1001', '12.5', 'abc', ''])('rejects invalid radius %p', async (value) => {
    const res = await put(value)
    expect(res.status).toBe(400)
    expect(prisma.systemSetting.upsert).not.toHaveBeenCalled()
  })

  it('saves a valid radius', async () => {
    const res = await put('50')
    expect(res.status).toBe(200)
    expect((await res.json()).value).toBe('50')
  })

  it('exposes the default radius in GET', async () => {
    ;(prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([])
    const res = await GET(new Request('http://localhost/api/admin/settings') as any)
    expect((await res.json()).CHECKIN_RADIUS_METERS).toBe('10')
  })
})
