import { prisma } from '@/lib/db'
import ReportsClient from './ReportsClient'

export default async function AdminReportsPage() {
  const rawReports = await prisma.learningReport.findMany({
    include: {
      student: { select: { id: true, name: true } },
      tutor: { select: { name: true } },
      schedule: {
        select: {
          date: true,
          topic: true,
          class: { select: { name: true } },
        },
      },
      media: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const reports = rawReports.map((r) => ({
    id: r.id,
    content: r.content,
    score: r.score,
    createdAt: r.createdAt.toISOString(),
    student: { id: r.student.id, name: r.student.name },
    tutor: { name: r.tutor.name },
    schedule: {
      date: r.schedule.date.toISOString(),
      topic: r.schedule.topic,
      class: { name: r.schedule.class.name },
    },
    media: r.media.map((m) => ({
      id: m.id,
      url: m.url,
      type: m.type,
      filename: m.filename,
    })),
  }))

  return <ReportsClient initialReports={reports} />
}
