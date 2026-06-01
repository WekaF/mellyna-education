import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PROGRAMS, type ProgramKey } from '@/lib/program-config'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
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

    return NextResponse.json(stats)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
