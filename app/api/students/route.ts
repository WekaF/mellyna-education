import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const createStudentSchema = z.object({
  name: z.string().min(1),
  grade: z.string().optional(),
  birthDate: z.string().optional(),
  notes: z.string().optional(),
  parentId: z.string().min(1),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id

  let students
  if (role === 'PARENT') {
    students = await prisma.student.findMany({
      where: { parentId: userId },
      include: { parent: { select: { name: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    })
  } else {
    students = await prisma.student.findMany({
      include: { parent: { select: { name: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  return NextResponse.json(students)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createStudentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { birthDate, ...rest } = parsed.data
  const student = await prisma.student.create({
    data: {
      ...rest,
      birthDate: birthDate ? new Date(birthDate) : undefined,
    },
  })

  return NextResponse.json(student, { status: 201 })
}
