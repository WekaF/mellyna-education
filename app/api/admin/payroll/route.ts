import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isValidPeriodMonth } from '@/lib/payroll'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const periodMonth = req.nextUrl.searchParams.get('periodMonth')
  if (!periodMonth || !isValidPeriodMonth(periodMonth)) {
    return NextResponse.json({ error: 'periodMonth wajib diisi, format YYYY-MM' }, { status: 400 })
  }

  const entries = await prisma.payrollEntry.findMany({
    where: { periodMonth },
    include: { tutor: { select: { id: true, name: true } } },
    orderBy: { tutor: { name: 'asc' } },
  })

  return NextResponse.json({ entries })
}
