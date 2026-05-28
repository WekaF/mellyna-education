import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const createScheduleSchema = z.object({
  classId: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  topic: z.string().optional(),
  location: z.string().optional(),
  studentIds: z.array(z.string().min(1)).min(1, 'Pilih minimal 1 siswa'),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const classId = searchParams.get('classId')

  let schedules
  if (role === 'TUTOR') {
    schedules = await prisma.schedule.findMany({
      where: { class: { tutorId: userId }, ...(classId ? { classId } : {}) },
      include: {
        class: { include: { tutor: { select: { name: true } } } },
        _count: { select: { participants: true } },
      },
      orderBy: { date: 'desc' },
    })
  } else if (role === 'PARENT') {
    schedules = await prisma.schedule.findMany({
      where: {
        status: 'PUBLISHED',
        participants: { some: { student: { parentId: userId } } },
        ...(classId ? { classId } : {}),
      },
      include: {
        class: { include: { tutor: { select: { name: true } } } },
        _count: { select: { participants: true } },
      },
      orderBy: { date: 'desc' },
    })
  } else {
    schedules = await prisma.schedule.findMany({
      where: classId ? { classId } : {},
      include: {
        class: { include: { tutor: { select: { name: true } } } },
        _count: { select: { participants: true } },
      },
      orderBy: { date: 'desc' },
    })
  }

  return NextResponse.json(schedules)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { studentIds, ...scheduleData } = parsed.data

  const schedule = await prisma.schedule.create({
    data: { ...scheduleData, date: new Date(scheduleData.date) },
  })

  await prisma.scheduleParticipant.createMany({
    data: studentIds.map((studentId) => ({ scheduleId: schedule.id, studentId })),
    skipDuplicates: true,
  })

  return NextResponse.json(schedule, { status: 201 })
}
