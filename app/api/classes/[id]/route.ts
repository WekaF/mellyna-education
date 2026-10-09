import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DayOfWeek, Program } from '@prisma/client'
import { resolveMainProgram } from '@/lib/main-program'
import { isEnumProgram } from '@/lib/program-config'

const classDetailInclude = {
  tutor: { select: { id: true, name: true, email: true } },
  additionalTutors: {
    include: {
      tutor: { select: { id: true, name: true } },
    },
  },
  programs: { select: { program: true } },
  enrollments: { include: { student: true } },
  schedules: { orderBy: { date: 'desc' as const }, take: 5 },
}

const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  mainProgram: z.string().min(1).nullish(),
  programs: z.array(z.nativeEnum(Program)).optional(),
  description: z.string().optional(),
  tutorId: z.string().optional(),
  additionalTutorIds: z.array(z.string()).optional(),
  dayOfWeek: z.nativeEnum(DayOfWeek).nullable().optional(),
  timeSlot: z.string().nullable().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const kelas = await prisma.class.findUnique({ where: { id }, include: classDetailInclude })

  if (!kelas) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  return NextResponse.json(kelas)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = updateClassSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { programs: requestedPrograms, additionalTutorIds, mainProgram: requestedMain, ...classData } = parsed.data
  let mainProgram: string | undefined
  if (requestedMain) {
    const resolved = await resolveMainProgram(requestedMain, [])
    if (!resolved) return NextResponse.json({ error: 'Program utama tidak ditemukan.' }, { status: 400 })
    mainProgram = resolved
  }

  // Keep the enum main program in ClassProgram so enrollment matching still works
  let programs = requestedPrograms
  if (programs) {
    const current = await prisma.class.findUnique({ where: { id }, select: { mainProgram: true } })
    if (!current) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    const effectiveMain = mainProgram ?? current.mainProgram
    if (effectiveMain && isEnumProgram(effectiveMain) && !programs.includes(effectiveMain as Program)) {
      programs = [effectiveMain as Program, ...programs]
    }
    if (programs.length === 0 && !effectiveMain) {
      return NextResponse.json({ error: 'Pilih program utama atau minimal satu program.' }, { status: 400 })
    }
  }

  const kelas = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (programs) {
      await tx.classProgram.deleteMany({ where: { classId: id } })
      await tx.classProgram.createMany({
        data: programs.map(program => ({ classId: id, program })),
      })
    }
    if (additionalTutorIds !== undefined) {
      await tx.classTutor.deleteMany({ where: { classId: id } })
      const primaryTutorId = classData.tutorId
      const filteredIds = primaryTutorId
        ? additionalTutorIds.filter(tid => tid !== primaryTutorId)
        : additionalTutorIds
      if (filteredIds.length > 0) {
        await tx.classTutor.createMany({
          data: filteredIds.map(tutorId => ({ classId: id, tutorId })),
          skipDuplicates: true,
        })
      }
    }
    return tx.class.update({
      where: { id },
      data: { ...classData, ...(mainProgram ? { mainProgram } : {}) },
      include: classDetailInclude,
    })
  })

  return NextResponse.json(kelas)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  await prisma.class.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
