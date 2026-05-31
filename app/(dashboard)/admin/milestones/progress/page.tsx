import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import StudentProgressClient from './StudentProgressClient'

export default async function AdminMilestoneProgressPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') redirect('/admin')

  const [students, milestones] = await Promise.all([
    prisma.student.findMany({
      where: { isActive: true },
      select: { id: true, name: true, grade: true },
      orderBy: { name: 'asc' },
    }),
    prisma.milestone.findMany({
      orderBy: [{ program: 'asc' }, { order: 'asc' }],
    }),
  ])

  return <StudentProgressClient students={students} milestones={milestones} />
}
