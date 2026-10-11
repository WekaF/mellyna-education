import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'
import { summarizeTutorAttendance } from '@/lib/tutor-monitoring'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : defaultFrom
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : now

  const tutors = await prisma.user.findMany({
    where: { role: Role.TUTOR },
    select: {
      id: true,
      name: true,
      email: true,
      suspended: true,
      tutorCheckIns: {
        where: { checkedInAt: { gte: from, lte: to } },
        select: {
          id: true,
          scheduleId: true,
          date: true,
          checkedInAt: true,
          distanceM: true,
          isWithinRadius: true,
        },
        orderBy: { checkedInAt: 'desc' },
      },
      tutorClasses: {
        select: {
          schedules: {
            where: {
              date: { gte: from, lte: to },
              status: { in: ['PUBLISHED', 'COMPLETED'] },
            },
            select: { id: true, date: true, startTime: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(
    tutors.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      suspended: t.suspended,
      ...summarizeTutorAttendance(
        t.tutorClasses.flatMap((c) => c.schedules),
        t.tutorCheckIns,
      ),
    })),
  )
}
