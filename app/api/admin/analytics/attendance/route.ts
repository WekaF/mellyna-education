import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const dateFilter = startDate || endDate ? {
    schedule: {
      date: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      },
    },
  } : {}

  const students = await prisma.student.findMany({
    select: {
      id: true,
      name: true,
      grade: true,
      attendances: {
        where: dateFilter,
        select: { status: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const result = students.map((s) => {
    const total = s.attendances.length
    const present = s.attendances.filter((a) => a.status === 'PRESENT').length
    const absent = s.attendances.filter((a) => a.status === 'ABSENT').length
    const sick = s.attendances.filter((a) => a.status === 'SICK').length
    const permission = s.attendances.filter((a) => a.status === 'PERMISSION').length
    const rate = total > 0 ? Math.round((present / total) * 100) : null

    return { id: s.id, name: s.name, grade: s.grade, total, present, absent, sick, permission, rate }
  })

  return NextResponse.json(result)
}
