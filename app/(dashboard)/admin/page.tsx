import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const eightWeeksAgo = new Date(now)
  eightWeeksAgo.setDate(now.getDate() - 56)
  eightWeeksAgo.setHours(0, 0, 0, 0)

  const [
    totalStudents,
    totalClasses,
    schedulesToday,
    overdueCount,
    revenueThisMonth,
    paidLastSixMonths,
    invoiceStatusGroups,
    allEnrollments,
    recentAttendances,
    attendancesThisMonth,
    overdueInvoices,
    pendingInvoices,
    todaySchedules,
  ] = await Promise.all([
    prisma.student.count({ where: { isActive: true } }),
    prisma.class.count(),
    prisma.schedule.count({
      where: {
        date: { gte: today, lt: tomorrow },
        status: { in: ['PUBLISHED', 'COMPLETED'] },
      },
    }),
    prisma.invoice.count({ where: { status: 'OVERDUE' } }),
    prisma.invoice.aggregate({
      where: { status: 'PAID', createdAt: { gte: firstOfMonth } },
      _sum: { amount: true },
    }),
    prisma.invoice.findMany({
      where: { status: 'PAID', createdAt: { gte: sixMonthsAgo } },
      select: { amount: true, createdAt: true },
    }),
    prisma.invoice.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.enrollment.findMany({
      include: { class: { select: { mainProgram: true } } },
    }),
    prisma.attendance.findMany({
      where: { schedule: { date: { gte: eightWeeksAgo } } },
      select: { status: true, schedule: { select: { date: true } } },
    }),
    prisma.attendance.findMany({
      where: { schedule: { date: { gte: firstOfMonth } } },
      select: { status: true },
    }),
    prisma.invoice.findMany({
      where: { status: 'OVERDUE' },
      include: { student: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 4,
    }),
    prisma.invoice.findMany({
      where: { status: 'PENDING' },
      include: { student: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 4,
    }),
    prisma.schedule.findMany({
      where: {
        date: { gte: today, lt: tomorrow },
        status: { in: ['PUBLISHED', 'COMPLETED'] },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        topic: true,
        status: true,
        class: {
          select: {
            name: true,
            tutor: { select: { name: true } },
          },
        },
      },
      orderBy: { startTime: 'asc' },
      take: 10,
    }),
  ])

  // Revenue by month (last 6 months)
  const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const monthRevenue = paidLastSixMonths
      .filter((inv) => {
        const invDate = new Date(inv.createdAt)
        return invDate.getFullYear() === d.getFullYear() && invDate.getMonth() === d.getMonth()
      })
      .reduce((sum, inv) => sum + inv.amount, 0)
    return {
      month: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
      revenue: monthRevenue,
    }
  })

  // Invoice status distribution
  const STATUS_LABELS: Record<string, string> = {
    PAID: 'Lunas',
    PENDING: 'Pending',
    OVERDUE: 'Terlambat',
    CANCELLED: 'Dibatalkan',
  }
  const invoiceDistribution = invoiceStatusGroups.map((g) => ({
    status: STATUS_LABELS[g.status] ?? g.status,
    count: g._count.id,
    amount: g._sum.amount ?? 0,
  }))

  // Program distribution (enrollments per program)
  const programMap: Record<string, number> = {}
  for (const e of allEnrollments) {
    const prog = e.class.mainProgram ?? 'Lainnya'
    programMap[prog] = (programMap[prog] ?? 0) + 1
  }
  const programDistribution = Object.entries(programMap)
    .map(([program, count]) => ({ program, count }))
    .sort((a, b) => b.count - a.count)

  // Weekly attendance trend (last 8 weeks)
  const attendanceTrend = Array.from({ length: 8 }, (_, i) => {
    const wEnd = new Date(now)
    wEnd.setDate(now.getDate() - i * 7)
    wEnd.setHours(23, 59, 59, 999)
    const wStart = new Date(wEnd)
    wStart.setDate(wEnd.getDate() - 6)
    wStart.setHours(0, 0, 0, 0)
    const weekAttendances = recentAttendances.filter((a) => {
      const d = new Date(a.schedule.date)
      return d >= wStart && d <= wEnd
    })
    const rate =
      weekAttendances.length > 0
        ? Math.round(
            (weekAttendances.filter((a) => a.status === 'PRESENT').length / weekAttendances.length) * 100,
          )
        : 0
    return {
      label: wStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      rate,
    }
  }).reverse()

  // Attendance rate this month
  const attendanceRateThisMonth =
    attendancesThisMonth.length > 0
      ? Math.round(
          (attendancesThisMonth.filter((a) => a.status === 'PRESENT').length /
            attendancesThisMonth.length) *
            100,
        )
      : null

  // Invoices needing attention: overdue first, then pending
  const invoicesNeedingAttention = [
    ...overdueInvoices.map((inv) => ({
      id: inv.id,
      studentName: inv.student.name,
      description: inv.description,
      amount: inv.amount,
      dueDate: inv.dueDate.toISOString(),
      isOverdue: true,
    })),
    ...pendingInvoices.map((inv) => ({
      id: inv.id,
      studentName: inv.student.name,
      description: inv.description,
      amount: inv.amount,
      dueDate: inv.dueDate.toISOString(),
      isOverdue: false,
    })),
  ]

  return (
    <DashboardClient
      stats={{
        totalStudents,
        totalClasses,
        schedulesToday,
        overdueCount,
        revenueThisMonth: revenueThisMonth._sum.amount ?? 0,
        attendanceRateThisMonth,
      }}
      revenueByMonth={revenueByMonth}
      invoiceDistribution={invoiceDistribution}
      programDistribution={programDistribution}
      attendanceTrend={attendanceTrend}
      invoicesNeedingAttention={invoicesNeedingAttention}
      todaySchedules={todaySchedules.map((s) => ({
        id: s.id,
        className: s.class.name,
        tutorName: s.class.tutor?.name ?? 'N/A',
        startTime: s.startTime,
        endTime: s.endTime,
        topic: s.topic,
        status: s.status,
      }))}
    />
  )
}
