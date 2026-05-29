import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { AttendanceStatus } from '@prisma/client'

const createExcuseSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum([AttendanceStatus.SICK, AttendanceStatus.PERMISSION]),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id

  if (role !== 'PARENT') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: scheduleId } = await params

  try {
    const body = await req.json()
    const parsed = createExcuseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { studentId, status, notes } = parsed.data

    // 1. Verify student exists and belongs to the active parent
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { parentId: true, name: true }
    })

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    if (student.parentId !== userId) {
      return NextResponse.json({ error: 'Forbidden: Student is not registered under this parent' }, { status: 403 })
    }

    // 2. Verify schedule exists
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId }
    })

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // 3. Upsert Attendance record
    const excuseNotes = notes 
      ? `Diajukan oleh Orang Tua: ${notes}` 
      : 'Diajukan oleh Orang Tua'

    const attendance = await prisma.attendance.upsert({
      where: {
        studentId_scheduleId: { studentId, scheduleId }
      },
      update: {
        status,
        notes: excuseNotes,
        markedAt: new Date(),
      },
      create: {
        studentId,
        scheduleId,
        status,
        notes: excuseNotes,
        markedAt: new Date(),
      }
    })

    console.log(`[Parent Excuse] Successfully logged excuse for student ${student.name} on schedule ${scheduleId}: status=${status}`)

    return NextResponse.json(attendance)
  } catch (err: any) {
    console.error('[Parent Excuse Error]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
