import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const updateStudentSchema = z.object({
  name: z.string().min(1).optional(),
  grade: z.string().optional(),
  birthDate: z.string().optional(),
  notes: z.string().optional(),
  parentId: z.string().min(1).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      parent: { select: { name: true, email: true, phone: true } },
      enrollments: { include: { class: true } },
    },
  })

  if (!student) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  return NextResponse.json(student)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = updateStudentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { birthDate, ...rest } = parsed.data
  if (rest.parentId) {
    const parent = await prisma.user.findUnique({ where: { id: rest.parentId } })
    if (!parent) return NextResponse.json({ error: 'Parent not found' }, { status: 400 })
  }
  const student = await prisma.student.update({
    where: { id },
    data: { ...rest, birthDate: birthDate ? new Date(birthDate) : undefined },
  })

  return NextResponse.json(student)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  await prisma.student.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
