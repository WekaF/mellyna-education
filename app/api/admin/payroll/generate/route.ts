import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { calculatePayrollAmounts, gatherPayrollCounts, isValidPeriodMonth } from '@/lib/payroll'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { periodMonth } = await req.json()
  if (typeof periodMonth !== 'string' || !isValidPeriodMonth(periodMonth)) {
    return NextResponse.json({ error: 'periodMonth wajib diisi, format YYYY-MM' }, { status: 400 })
  }

  const tutors = await prisma.user.findMany({ where: { role: 'TUTOR' }, select: { id: true } })

  const results = []
  for (const t of tutors) {
    const existing = await prisma.payrollEntry.findUnique({
      where: { tutorId_periodMonth: { tutorId: t.id, periodMonth } },
    })
    if (existing?.status === 'FINALIZED') {
      results.push({ tutorId: t.id, skipped: true, reason: 'finalized' })
      continue
    }

    const rate = await prisma.tutorPayrollRate.findUnique({ where: { tutorId: t.id } })
    if (!rate) {
      results.push({ tutorId: t.id, skipped: true, reason: 'no-rate' })
      continue
    }

    const counts = await gatherPayrollCounts(t.id, periodMonth)
    const amounts = calculatePayrollAmounts(rate, counts)
    const data = { tutorId: t.id, periodMonth, ...counts, ...amounts }

    const entry = await prisma.payrollEntry.upsert({
      where: { tutorId_periodMonth: { tutorId: t.id, periodMonth } },
      update: { ...counts, ...amounts, generatedAt: new Date() },
      create: data,
    })
    results.push({ tutorId: t.id, entry })
  }

  return NextResponse.json({ results })
}
