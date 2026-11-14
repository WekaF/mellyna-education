import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import PayrollClient from './PayrollClient'

export default async function AdminPayrollPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') redirect('/admin')

  const now = new Date()
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [tutors, entries, pendingLeaves, overtimeEntries] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'TUTOR' },
      select: { id: true, name: true, payrollRate: true },
      orderBy: { name: 'asc' },
    }),
    prisma.payrollEntry.findMany({
      where: { periodMonth: defaultPeriod },
      include: { tutor: { select: { id: true, name: true } } },
      orderBy: { tutor: { name: 'asc' } },
    }),
    prisma.tutorLeaveRequest.findMany({
      where: { status: 'PENDING' },
      include: { tutor: { select: { id: true, name: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.tutorOvertimeEntry.findMany({
      include: { tutor: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
      take: 20,
    }),
  ])

  return (
    <PayrollClient
      defaultPeriod={defaultPeriod}
      tutors={tutors.map((t) => ({
        id: t.id,
        name: t.name,
        rate: t.payrollRate
          ? {
              dailyRate: t.payrollRate.dailyRate,
              onTimeBonusRate: t.payrollRate.onTimeBonusRate,
              overtimeRatePerHour: t.payrollRate.overtimeRatePerHour,
              extraHandleRate: t.payrollRate.extraHandleRate,
            }
          : null,
      }))}
      initialEntries={entries.map((e) => ({
        id: e.id,
        tutor: e.tutor,
        periodMonth: e.periodMonth,
        hariKerja: e.hariKerja,
        izinHari: e.izinHari,
        bonusOntimeDays: e.bonusOntimeDays,
        extraTimeHours: e.extraTimeHours,
        extraHandleCount: e.extraHandleCount,
        dailyRateAmount: e.dailyRateAmount,
        bonusOntimeAmount: e.bonusOntimeAmount,
        extraTimeAmount: e.extraTimeAmount,
        extraHandleAmount: e.extraHandleAmount,
        totalAmount: e.totalAmount,
        status: e.status,
      }))}
      pendingLeaves={pendingLeaves.map((l) => ({
        id: l.id,
        tutor: l.tutor,
        date: l.date.toISOString(),
        reason: l.reason,
      }))}
      overtimeEntries={overtimeEntries.map((o) => ({
        id: o.id,
        tutor: o.tutor,
        date: o.date.toISOString(),
        hours: o.hours,
        note: o.note,
      }))}
    />
  )
}
