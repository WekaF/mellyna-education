import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tutors = await prisma.user.findMany({
    where: { role: Role.TUTOR },
    select: {
      id: true,
      name: true,
      email: true,
      suspended: true,
      tutorClasses: {
        select: {
          schedules: {
            select: {
              id: true,
              status: true,
              reports: { select: { id: true } },
              attendances: { select: { status: true } },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const result = tutors.map((t) => {
    const schedules = t.tutorClasses.flatMap((c) => c.schedules)
    const totalSchedules = schedules.length
    const completedSchedules = schedules.filter((s) => s.status === 'COMPLETED').length
    const reportsFilled = schedules.filter((s) => s.reports.length > 0).length
    const reportRate = totalSchedules > 0 ? Math.round((reportsFilled / totalSchedules) * 100) : null

    const allAttendances = schedules.flatMap((s) => s.attendances)
    const presentCount = allAttendances.filter((a) => a.status === 'PRESENT').length
    const avgAttendanceRate = allAttendances.length > 0 ? Math.round((presentCount / allAttendances.length) * 100) : null

    return {
      id: t.id,
      name: t.name,
      email: t.email,
      suspended: t.suspended,
      totalSchedules,
      completedSchedules,
      reportsFilled,
      reportRate,
      avgAttendanceRate,
    }
  })

  return NextResponse.json(result)
}
