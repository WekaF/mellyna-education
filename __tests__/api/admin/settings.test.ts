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
