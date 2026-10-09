import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import MainProgramsClient from './MainProgramsClient'

export default async function MainProgramsPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/admin')

  const rows = await prisma.mainProgram.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { classes: true } } },
  })

  return <MainProgramsClient initial={JSON.parse(JSON.stringify(rows))} />
}
