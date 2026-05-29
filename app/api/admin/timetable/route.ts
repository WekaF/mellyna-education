import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const classes = await prisma.class.findMany({
    where: { dayOfWeek: { not: null } },
    include: {
      tutor: { select: { id: true, name: true } },
      enrollments: {
        include: { student: { select: { id: true, name: true } } },
        orderBy: { student: { name: 'asc' } },
      },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { timeSlot: 'asc' }],
  })

  return NextResponse.json(classes)
}
