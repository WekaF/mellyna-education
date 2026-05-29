import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId')

  let where: Record<string, unknown> = {}

  if (role === 'PARENT') {
    const children = await prisma.student.findMany({
      where: { parentId: userId },
      select: { id: true },
    })
    const childIds = children.map((c) => c.id)
    where = { studentId: { in: childIds } }
    if (studentId && childIds.includes(studentId)) {
      where = { studentId }
    }
  } else if (role === 'TUTOR') {
    where = { tutorId: userId }
    if (studentId) where = { ...where, studentId }
  } else if (role === 'SUPER_ADMIN') {
    if (studentId) where = { studentId }
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const reports = await prisma.learningReport.findMany({
    where,
    include: {
      student: { select: { id: true, name: true, grade: true } },
      tutor: { select: { id: true, name: true } },
      schedule: {
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          topic: true,
          location: true,
          class: { select: { name: true, subject: true } },
        },
      },
      media: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(reports)
}
