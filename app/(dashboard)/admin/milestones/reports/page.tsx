import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import MilestoneReportsClient from './MilestoneReportsClient'

export default async function AdminMilestoneReportsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') redirect('/admin')

  const [students, reports] = await Promise.all([
    prisma.student.findMany({
      where: { isActive: true },
      select: { id: true, name: true, grade: true },
      orderBy: { name: 'asc' },
    }),
    prisma.milestoneReport.findMany({
      include: {
        student: { select: { name: true } },
        generatedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return <MilestoneReportsClient students={students} initialReports={reports as any} />
}
