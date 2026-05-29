import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id

  if (role !== 'TUTOR' && role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: scheduleId } = await params

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: { class: { select: { tutorId: true } } },
  })
  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

  if (role === 'TUTOR' && schedule.class.tutorId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { studentId, content, score } = body

  if (!studentId || !content) {
    return NextResponse.json({ error: 'studentId and content are required' }, { status: 400 })
  }

  const participant = await prisma.scheduleParticipant.findUnique({
    where: { scheduleId_studentId: { scheduleId, studentId } },
  })
  if (!participant) {
    return NextResponse.json({ error: 'Student is not a participant of this schedule' }, { status: 400 })
  }

  const report = await prisma.learningReport.upsert({
    where: { studentId_scheduleId: { studentId, scheduleId } },
    create: {
      studentId,
      scheduleId,
      tutorId: userId,
      content,
      score: score != null ? Number(score) : null,
    },
    update: {
      content,
      score: score != null ? Number(score) : null,
    },
    include: {
      student: { select: { id: true, name: true, grade: true } },
    },
  })

  return NextResponse.json(report, { status: 201 })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: scheduleId } = await params

  const reports = await prisma.learningReport.findMany({
    where: { scheduleId },
    include: {
      student: { select: { id: true, name: true, grade: true } },
      tutor: { select: { id: true, name: true } },
      media: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(reports)
}
