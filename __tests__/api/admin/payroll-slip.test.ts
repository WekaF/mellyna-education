import { GET } from '@/app/api/admin/payroll/[id]/slip/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({ prisma: { payrollEntry: { findUnique: jest.fn() } } }))

const entry = {
  id: 'p1',
  tutor: { name: 'Budi Santoso' },
  periodMonth: '2026-11',
  hariKerja: 20,
  dailyRateAmount: 1_000_000,
  izinHari: 1,
  bonusOntimeDays: 18,
  bonusOntimeAmount: 180_000,
  extraTimeHours: 5,
  extraTimeAmount: 100_000,
  extraHandleCount: 3,
  extraHandleAmount: 90_000,
  totalAmount: 1_370_000,
  status: 'DRAFT',
  generatedAt: new Date('2026-11-30T10:00:00Z'),
}

const call = (role = 'SUPER_ADMIN') => {
  ;(getServerSession as jest.Mock).mockResolvedValue(role ? { user: { role } } : null)
  return GET(new NextRequest('http://x'), { params: Promise.resolve({ id: 'p1' }) })
}

describe('GET /api/admin/payroll/[id]/slip', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.payrollEntry.findUnique as jest.Mock).mockResolvedValue(entry)
  })

  it('returns 401 when not authenticated', async () => {
    expect((await call('')).status).toBe(401)
  })

  it('returns 403 for a tutor', async () => {
    expect((await call('TUTOR')).status).toBe(403)
  })

  it('returns 404 when the entry does not exist', async () => {
    ;(prisma.payrollEntry.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await call()).status).toBe(404)
  })

  it('returns a PDF with the correct headers', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toBe(
      'attachment; filename="SLIP_GAJI_Budi_Santoso_2026-11.pdf"',
    )
  })
})
