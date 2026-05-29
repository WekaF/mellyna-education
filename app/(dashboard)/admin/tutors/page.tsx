import { prisma } from '@/lib/db'
import TutorsClient from './TutorsClient'

export default async function AdminTutorsPage() {
  const rawTutors = await prisma.user.findMany({
    where: { role: 'TUTOR' },
    select: { id: true, name: true, email: true, phone: true, suspended: true, createdAt: true },
    orderBy: { name: 'asc' },
  })

  const tutors = rawTutors.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }))

  return <TutorsClient initialTutors={tutors} />
}
