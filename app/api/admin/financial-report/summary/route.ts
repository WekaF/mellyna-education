import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null
  const classId = searchParams.get('classId') ?? null

  const dateFilter =
    month !== null && year !== null
      ? { createdAt: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } }
      : year !== null
      ? { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } }
      : {}

  const classFilter = classId ? { student: { enrollments: { some: { classId } } } } : {}

  const invoices = await prisma.invoice.findMany({
    where: { ...dateFilter, ...classFilter },
    select: { amount: true, status: true },
  })

  const summary = {
    total:     { count: invoices.length, amount: invoices.reduce((s, i) => s + i.amount, 0) },
    paid:      { count: invoices.filter(i => i.status === 'PAID').length,      amount: invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0) },
    pending:   { count: invoices.filter(i => i.status === 'PENDING').length,   amount: invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.amount, 0) },
    overdue:   { count: invoices.filter(i => i.status === 'OVERDUE').length,   amount: invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.amount, 0) },
    cancelled: { count: invoices.filter(i => i.status === 'CANCELLED').length, amount: invoices.filter(i => i.status === 'CANCELLED').reduce((s, i) => s + i.amount, 0) },
  }

  return NextResponse.json(summary)
}
