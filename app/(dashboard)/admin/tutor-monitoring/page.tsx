import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'
import { summarizeTutorAttendance } from '@/lib/tutor-monitoring'
import TutorMonitoringClient from './TutorMonitoringClient'

export default async function TutorMonitoringPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/admin')

  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)

  const [tutors, accessRequests] = await Promise.all([
    prisma.user.findMany({
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
            scheduleId: true,
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
                // batas kasar; summarizeTutorAttendance yang membuang sesi yang belum mulai
                date: { gte: from, lte: now },
                status: { in: ['PUBLISHED', 'COMPLETED'] },
              },
              select: { id: true, date: true, startTime: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.reportAccessRequest.findMany({
      // enum diurutkan sesuai deklarasi: PENDING dulu
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        status: true,
        reason: true,
        adminNote: true,
        createdAt: true,
        tutor: { select: { name: true } },
        schedule: {
          select: { date: true, startTime: true, endTime: true, class: { select: { name: true } } },
        },
      },
    }),
  ])

  const initialData = tutors.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    suspended: t.suspended,
    ...summarizeTutorAttendance(
      t.tutorClasses.flatMap((c) => c.schedules),
      t.tutorCheckIns,
    ),
  }))

  const requests = accessRequests.map((r) => ({
    id: r.id,
    status: r.status,
    reason: r.reason,
    adminNote: r.adminNote,
    createdAt: r.createdAt.toISOString(),
    tutorName: r.tutor.name ?? '—',
    className: r.schedule.class.name,
    scheduleDate: r.schedule.date.toISOString(),
    startTime: r.schedule.startTime,
    endTime: r.schedule.endTime,
  }))

  return <TutorMonitoringClient initialData={initialData} requests={requests} />
}
