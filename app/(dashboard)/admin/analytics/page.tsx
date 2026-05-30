import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'
import AnalyticsClient from './AnalyticsClient'

export default async function AdminAnalyticsPage() {
  const [attendanceStudents, tutorUsers, studentProgress] = await Promise.all([
    // attendance/route.ts GET query
    prisma.student.findMany({
      select: {
        id: true,
        name: true,
        grade: true,
        attendances: {
          select: { status: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    // tutors/route.ts GET query
    prisma.user.findMany({
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
    }),
    // students/route.ts GET query
    prisma.student.findMany({
      select: {
        id: true,
        name: true,
        grade: true,
        isActive: true,
        reports: {
          select: { score: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        attendances: {
          select: { status: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  // Map attendance stats (mirrors attendance/route.ts logic)
  const attendanceStats = attendanceStudents.map((s) => {
    const total = s.attendances.length
    const present = s.attendances.filter((a) => a.status === 'PRESENT').length
    const absent = s.attendances.filter((a) => a.status === 'ABSENT').length
    const sick = s.attendances.filter((a) => a.status === 'SICK').length
    const permission = s.attendances.filter((a) => a.status === 'PERMISSION').length
    const rate = total > 0 ? Math.round((present / total) * 100) : null
    return { id: s.id, name: s.name, grade: s.grade, total, present, absent, sick, permission, rate }
  })

  // Map tutor stats (mirrors tutors/route.ts logic)
  const tutorStats = tutorUsers.map((t) => {
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

  // Map student progress stats (mirrors students/route.ts logic)
  const studentStats = studentProgress.map((s) => {
    const scoredReports = s.reports.filter((r) => r.score !== null)
    const avgScore = scoredReports.length > 0
      ? Math.round(scoredReports.reduce((sum, r) => sum + r.score!, 0) / scoredReports.length)
      : null
    const lastScore = scoredReports[0]?.score ?? null
    const lastActivity = s.reports[0]?.createdAt ?? null

    const total = s.attendances.length
    const present = s.attendances.filter((a) => a.status === 'PRESENT').length
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null

    let trend: 'up' | 'down' | 'stable' | null = null
    if (scoredReports.length >= 2) {
      const diff = scoredReports[0].score! - scoredReports[1].score!
      if (diff > 5) trend = 'up'
      else if (diff < -5) trend = 'down'
      else trend = 'stable'
    }

    return {
      id: s.id,
      name: s.name,
      grade: s.grade,
      isActive: s.isActive,
      totalReports: s.reports.length,
      avgScore,
      lastScore,
      // Serialize Date to ISO string for client component
      lastActivity: lastActivity ? lastActivity.toISOString() : null,
      attendanceRate,
      trend,
    }
  })

  return (
    <AnalyticsClient
      initialAttendance={attendanceStats}
      initialTutors={tutorStats}
      initialStudents={studentStats}
    />
  )
}
