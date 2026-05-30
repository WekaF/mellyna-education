import { prisma } from '@/lib/db'
import SchedulesClient from './SchedulesClient'

export default async function AdminSchedulesPage() {
  const [rawSchedules, classes] = await Promise.all([
    prisma.schedule.findMany({
      include: {
        class: {
          include: {
            tutor: { select: { name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.class.findMany({
      select: {
        id: true,
        name: true,
        tutor: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  const schedules = rawSchedules.map((s) => ({
    id: s.id,
    date: s.date.toISOString(),
    startTime: s.startTime,
    endTime: s.endTime,
    topic: s.topic,
    status: s.status,
    class: {
      name: s.class.name,
      tutor: { name: s.class.tutor.name },
    },
  }))

  return <SchedulesClient initialSchedules={schedules} classes={classes} />
}
