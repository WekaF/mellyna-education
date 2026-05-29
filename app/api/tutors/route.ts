import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tutors = await prisma.user.findMany({
    where: { role: Role.TUTOR },
    select: { id: true, name: true, email: true, phone: true, suspended: true, createdAt: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(tutors)
}
