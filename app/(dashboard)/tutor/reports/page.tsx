import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import ReportsClient from '@/components/reports/ReportsClient'

export default async function TutorReportsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const tutorId = (session.user as any).id

  const classes = await prisma.class.findMany({
    where: {
      OR: [
        { tutorId },
        { additionalTutors: { some: { tutorId } } },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return <ReportsClient classes={classes} apiEndpoint="/api/tutor/reports/list" />
}
