import { prisma } from '@/lib/db'
import ParentsClient from './ParentsClient'

export default async function AdminParentsPage() {
  const rawParents = await prisma.user.findMany({
    where: { role: 'PARENT' },
    include: {
      children: {
        include: {
          enrollments: {
            include: {
              class: {
                include: {
                  tutor: { select: { name: true } },
                },
              },
            },
          },
          invoices: {
            orderBy: { dueDate: 'desc' },
          },
          attendances: {
            orderBy: { markedAt: 'desc' },
          },
          reports: {
            include: {
              tutor: { select: { name: true } },
              schedule: { select: { date: true, topic: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const parents = rawParents.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    suspended: p.suspended,
    createdAt: p.createdAt.toISOString(),
    children: p.children.map((child) => ({
      id: child.id,
      name: child.name,
      grade: child.grade,
      notes: child.notes,
      isActive: child.isActive,
      createdAt: child.createdAt.toISOString(),
      enrollments: child.enrollments.map((enr) => ({
        id: enr.id,
        class: {
          id: enr.class.id,
          name: enr.class.name,
          subject: enr.class.description ?? '',
          tutor: { name: enr.class.tutor.name },
        },
      })),
      invoices: child.invoices.map((inv) => ({
        id: inv.id,
        amount: inv.amount,
        description: inv.description,
        dueDate: inv.dueDate.toISOString(),
        status: inv.status,
        paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
        createdAt: inv.createdAt.toISOString(),
      })),
      attendances: child.attendances.map((att) => ({
        id: att.id,
        status: att.status,
        notes: att.notes,
        markedAt: att.markedAt.toISOString(),
      })),
      reports: child.reports.map((rep) => ({
        id: rep.id,
        content: rep.content,
        score: rep.score,
        createdAt: rep.createdAt.toISOString(),
        tutor: { name: rep.tutor.name },
        schedule: {
          date: rep.schedule.date.toISOString(),
          topic: rep.schedule.topic,
        },
      })),
    })),
  }))

  return <ParentsClient initialParents={parents} />
}
