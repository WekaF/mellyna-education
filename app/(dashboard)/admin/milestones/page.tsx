import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import MilestonesClient from './MilestonesClient'

export default async function AdminMilestonesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') redirect('/admin')

  const milestones = await prisma.milestone.findMany({
    orderBy: [{ program: 'asc' }, { order: 'asc' }],
  })

  return <MilestonesClient initialMilestones={milestones} />
}
