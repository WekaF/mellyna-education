import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  description: z.string().optional(),
  tutorId: z.string().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const kelas = await prisma.class.findUnique({
    where: { id },
    include: {
      tutor: { select: { name: true, email: true } },
      enrollments: { include: { student: true } },
      schedules: { orderBy: { date: 'desc' }, take: 5 },
    },
  })

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

  const kelas = await prisma.class.update({ where: { id }, data: parsed.data })
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
