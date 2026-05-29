import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const upsertReportSchema = z.object({
  studentId: z.string().min(1),
  scheduleId: z.string().min(1),
  content: z.string().min(1),
  score: z.number().int().min(0).max(100).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId')
  const scheduleId = searchParams.get('scheduleId')

  let where: Record<string, unknown> = {}

  if (role === 'PARENT') {
    const children = await prisma.student.findMany({
      where: { parentId: userId },
      select: { id: true },
    })
    const childIds = children.map((c) => c.id)
    where = { studentId: { in: childIds } }
    if (studentId && childIds.includes(studentId)) where = { ...where, studentId }
  } else if (role === 'TUTOR') {
    where = { tutorId: userId }
    if (studentId) where = { ...where, studentId }
  } else if (role === 'SUPER_ADMIN') {
    if (studentId) where = { studentId }
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (scheduleId) where = { ...where, scheduleId }

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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id

  if (role !== 'SUPER_ADMIN' && role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = upsertReportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const report = await prisma.learningReport.upsert({
    where: {
      studentId_scheduleId: {
        studentId: parsed.data.studentId,
        scheduleId: parsed.data.scheduleId,
      },
    },
    update: { content: parsed.data.content, score: parsed.data.score },
    create: { ...parsed.data, tutorId: userId },
  })

  return NextResponse.json(report, { status: 201 })
}
