import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const updateScheduleSchema = z.object({
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  topic: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED']).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: {
      class: {
        include: {
          tutor: { select: { name: true, email: true } },
        },
      },
      participants: {
        include: {
          student: { select: { id: true, name: true, grade: true } },
        },
        orderBy: { student: { name: 'asc' } },
      },
      attendances: { include: { student: true } },
    },
  })

  if (!schedule) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  return NextResponse.json(schedule)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = updateScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { date, ...rest } = parsed.data
  const schedule = await prisma.schedule.update({
    where: { id },
    data: { ...rest, ...(date ? { date: new Date(date) } : {}) },
  })

  return NextResponse.json(schedule)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  await prisma.schedule.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
