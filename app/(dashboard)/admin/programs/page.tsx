import { prisma } from '@/lib/db'
import { PROGRAMS, type ProgramKey } from '@/lib/program-config'
import ProgramsClient from './ProgramsClient'

export default async function AdminProgramsPage() {
  const rows = await prisma.programEnrollment.groupBy({
    by: ['program'],
    where: { status: 'ACTIVE' },
    _count: { _all: true },
  })

  const stats: Record<ProgramKey, { activeStudents: number }> = {} as any
  for (const p of PROGRAMS) {
    const found = rows.find((r) => r.program === p)
    stats[p] = { activeStudents: found ? found._count._all : 0 }
  }

  return <ProgramsClient stats={stats} />
}
