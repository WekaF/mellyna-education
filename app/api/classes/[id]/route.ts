import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DayOfWeek, Program } from '@prisma/client'

const classInclude = {
  tutor: { select: { name: true, email: true } },
  programs: { select: { program: true } },
  enrollments: { include: { student: true } },
  schedules: { orderBy: { date: 'desc' as const }, take: 5 },
}

const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  programs: z.array(z.nativeEnum(Program)).min(1).optional(),
  description: z.string().optional(),
  tutorId: z.string().optional(),
  dayOfWeek: z.nativeEnum(DayOfWeek).nullable().optional(),
  timeSlot: z.string().nullable().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const kelas = await prisma.class.findUnique({ where: { id }, include: classInclude })

  if (!kelas) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  return NextResponse.json(kelas)
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
  const parsed = updateClassSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { programs, ...classData } = parsed.data
  const updateData: any = { ...classData }

  if (programs) {
    updateData.programs = {
      deleteMany: {},
      create: programs.map(program => ({ program })),
    }
  }

  const kelas = await prisma.class.update({
    where: { id },
    data: updateData,
    include: classInclude,
  })

  return NextResponse.json(kelas)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  await prisma.class.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
