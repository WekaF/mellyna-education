import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'
import TutorMonitoringClient from './TutorMonitoringClient'

export default async function TutorMonitoringPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/admin')

  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)

  const tutors = await prisma.user.findMany({
    where: { role: Role.TUTOR },
    select: {
      id: true,
      name: true,
      email: true,
      suspended: true,
      tutorCheckIns: {
        where: { checkedInAt: { gte: from } },
        select: {
          id: true,
          date: true,
          checkedInAt: true,
          distanceM: true,
          isWithinRadius: true,
        },
        orderBy: { checkedInAt: 'desc' },
      },
      tutorClasses: {
        select: {
          schedules: {
            where: {
              date: { gte: from },
              status: { in: ['PUBLISHED', 'COMPLETED'] },
            },
            select: { date: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const initialData = tutors.map((t) => {
    const scheduleDates = new Set(
      t.tutorClasses
        .flatMap((c) => c.schedules)
        .map((s) => s.date.toISOString().slice(0, 10)),
    )
    const totalScheduleDays = scheduleDates.size

    const validCheckInDates = new Set(
      t.tutorCheckIns.filter((c) => c.isWithinRadius).map((c) => c.date),
    )
    const totalValidDays = validCheckInDates.size

    const attendanceRate =
      totalScheduleDays > 0
        ? Math.round((totalValidDays / totalScheduleDays) * 100)
        : null

    const avgDistanceM =
      t.tutorCheckIns.length > 0
        ? Math.round(
            t.tutorCheckIns.reduce((sum, c) => sum + c.distanceM, 0) / t.tutorCheckIns.length,
          )
        : null

    return {
      id: t.id,
      name: t.name,
      email: t.email,
      suspended: t.suspended,
      totalScheduleDays,
      totalValidDays,
      attendanceRate,
      avgDistanceM,
      lastCheckIn: t.tutorCheckIns[0]?.checkedInAt.toISOString() ?? null,
      recentCheckIns: t.tutorCheckIns.slice(0, 7).map((c) => ({
        id: c.id,
        date: c.date,
        checkedInAt: c.checkedInAt.toISOString(),
        distanceM: Math.round(c.distanceM),
        isWithinRadius: c.isWithinRadius,
      })),
    }
  })

  return <TutorMonitoringClient initialData={initialData} />
}
