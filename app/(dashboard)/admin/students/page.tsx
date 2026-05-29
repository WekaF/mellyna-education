import { prisma } from '@/lib/db'
import StudentsClient from './StudentsClient'

export default async function AdminStudentsPage() {
  const [rawStudents, parents] = await Promise.all([
    prisma.student.findMany({
      include: { parent: { select: { name: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where: { role: 'PARENT' },
      select: { id: true, name: true, email: true },
    }),
  ])

  const students = rawStudents.map(s => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    birthDate: s.birthDate ? s.birthDate.toISOString() : null,
  }))

  return <StudentsClient initialStudents={students} parents={parents} />
}
