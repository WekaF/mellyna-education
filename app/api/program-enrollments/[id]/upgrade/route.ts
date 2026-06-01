import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const upgradeSchema = z.object({
  newProgram: z.enum(['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH']),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = upgradeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const current = await prisma.programEnrollment.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (current.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Hanya program yang ACTIVE yang bisa di-upgrade' }, { status: 400 })
  }

  const [, newEnrollment] = await prisma.$transaction([
    prisma.programEnrollment.update({
      where: { id },
      data: { status: 'UPGRADED', endedAt: new Date(), notes: parsed.data.notes },
    }),
    prisma.programEnrollment.create({
      data: {
        studentId: current.studentId,
        program: parsed.data.newProgram,
        status: 'ACTIVE',
      },
    }),
  ])

  return NextResponse.json(newEnrollment, { status: 201 })
}
