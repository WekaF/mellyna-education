import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const batchUpsertSchema = z.object({
  scheduleId: z.string().min(1),
  entries: z.array(z.object({
    studentId: z.string().min(1),
    status: z.enum(['PRESENT', 'ABSENT', 'SICK', 'PERMISSION']),
    notes: z.string().optional(),
  })),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const scheduleId = searchParams.get('scheduleId')
  const studentId = searchParams.get('studentId')

  const where: any = {}
  if (scheduleId) where.scheduleId = scheduleId
  if (studentId) where.studentId = studentId

  const attendances = await prisma.attendance.findMany({
    where,
    include: {
      student: { select: { id: true, name: true, grade: true } },
      schedule: { select: { id: true, date: true, startTime: true, endTime: true } },
    },
    orderBy: { markedAt: 'desc' },
  })

  return NextResponse.json(attendances)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = batchUpsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { scheduleId, entries } = parsed.data

  const results = await Promise.all(
    entries.map((entry) =>
      prisma.attendance.upsert({
        where: { studentId_scheduleId: { studentId: entry.studentId, scheduleId } },
        update: { status: entry.status, notes: entry.notes },
        create: { studentId: entry.studentId, scheduleId, status: entry.status, notes: entry.notes },
      })
    )
  )

  return NextResponse.json(results)
}
