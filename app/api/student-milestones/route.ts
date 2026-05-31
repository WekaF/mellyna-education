import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { MilestoneStatus, Program } from '@prisma/client'

const updateStatusSchema = z.object({
  studentId: z.string().min(1),
  milestoneId: z.string().min(1),
  status: z.nativeEnum(MilestoneStatus),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId')
  const program = searchParams.get('program') as Program | null

  // PARENT: can only see their own children
  if (role === 'PARENT') {
    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 })
    }
    const student = await prisma.student.findFirst({
      where: { id: studentId, parentId: userId },
    })
    if (!student) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const milestones = await prisma.milestone.findMany({
    where: program ? { program } : {},
    orderBy: [{ program: 'asc' }, { order: 'asc' }],
    include: {
      studentMilestones: studentId
        ? { where: { studentId } }
        : true,
    },
  })

  return NextResponse.json(milestones)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const updaterId = (session.user as any).id

  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = updateStatusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { studentId, milestoneId, status, notes } = parsed.data

  const completedAt = status === 'COMPLETED' ? new Date() : null

  const studentMilestone = await prisma.studentMilestone.upsert({
    where: { studentId_milestoneId: { studentId, milestoneId } },
    update: { status, notes, completedAt, updatedById: updaterId },
    create: { studentId, milestoneId, status, notes, completedAt, updatedById: updaterId },
  })

  return NextResponse.json(studentMilestone)
}
