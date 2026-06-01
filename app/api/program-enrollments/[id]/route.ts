import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const patchSchema = z.object({
  status: z.enum(['COMPLETED', 'DROPPED']),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const enrollment = await prisma.programEnrollment.findUnique({
    where: { id },
    include: {
      student: { select: { name: true, parent: { select: { name: true } } } },
      enrollments: { include: { class: { select: { name: true } } } },
    },
  })

  if (!enrollment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(enrollment)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await prisma.programEnrollment.update({
    where: { id },
    data: {
      status: parsed.data.status,
      notes: parsed.data.notes,
      endedAt: new Date(),
    },
  })

  return NextResponse.json(updated)
}
