import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tutors = await prisma.user.findMany({
    where: { role: 'TUTOR' },
    select: { id: true, name: true, payrollRate: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ tutors })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { tutorId, dailyRate, onTimeBonusRate, overtimeRatePerHour, extraHandleRate } = await req.json()
  if (typeof tutorId !== 'string' || !tutorId) {
    return NextResponse.json({ error: 'tutorId wajib diisi' }, { status: 400 })
  }
  if (
    !isPositiveInt(dailyRate) ||
    !isPositiveInt(onTimeBonusRate) ||
    !isPositiveInt(overtimeRatePerHour) ||
    !isPositiveInt(extraHandleRate)
  ) {
    return NextResponse.json({ error: 'Semua rate wajib diisi angka bulat >= 0' }, { status: 400 })
  }

  const rate = await prisma.tutorPayrollRate.upsert({
    where: { tutorId },
    update: { dailyRate, onTimeBonusRate, overtimeRatePerHour, extraHandleRate },
    create: { tutorId, dailyRate, onTimeBonusRate, overtimeRatePerHour, extraHandleRate },
  })

  return NextResponse.json({ rate })
}
