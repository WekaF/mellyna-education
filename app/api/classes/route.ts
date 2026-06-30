import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DayOfWeek, Program } from '@prisma/client'

const classListInclude = {
  tutor: { select: { id: true, name: true, email: true } },
  additionalTutors: {
    include: {
      tutor: { select: { id: true, name: true } },
    },
  },
  _count: { select: { enrollments: true } },
  programs: { select: { program: true } },
  enrollments: {
    include: {
      student: { select: { id: true, name: true, grade: true } },
    },
  },
}

const createClassSchema = z.object({
  name: z.string().min(1),
  mainProgram: z.nativeEnum(Program).optional(),
  programs: z.array(z.nativeEnum(Program)).min(1),
  description: z.string().optional(),
  tutorId: z.string().min(1),
  additionalTutorIds: z.array(z.string()).optional(),
  dayOfWeek: z.nativeEnum(DayOfWeek).nullable().optional(),
  timeSlot: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id

  const where = role === 'TUTOR'
    ? {
        OR: [
          { tutorId: userId },
          { additionalTutors: { some: { tutorId: userId } } },
        ],
      }
    : {}

  const classes = await prisma.class.findMany({
    where,
    include: classListInclude,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(classes)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createClassSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { programs, additionalTutorIds, ...classData } = parsed.data
  const mainProgram = classData.mainProgram || programs[0]

  const kelas = await prisma.$transaction(async (tx) => {
    const created = await tx.class.create({
      data: {
        ...classData,
        mainProgram,
        programs: {
          create: programs.map(program => ({ program })),
        },
      },
    })
    if (additionalTutorIds && additionalTutorIds.length > 0) {
      await tx.classTutor.createMany({
        data: additionalTutorIds
          .filter(id => id !== classData.tutorId)
          .map(tutorId => ({ classId: created.id, tutorId })),
        skipDuplicates: true,
      })
    }
    return tx.class.findUniqueOrThrow({ where: { id: created.id }, include: classListInclude })
  })

  return NextResponse.json(kelas, { status: 201 })
}
