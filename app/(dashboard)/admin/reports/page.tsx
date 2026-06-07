import { prisma } from '@/lib/db'
import ReportsClient from './ReportsClient'

export default async function AdminReportsPage() {
  const classes = await prisma.class.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return <ReportsClient classes={classes} />
}
