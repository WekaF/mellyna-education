import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const upgradeSchema = z.object({
  newPrograms: z.array(z.enum(['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH'])).min(1),
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

  try {
    const current = await prisma.programEnrollment.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (current.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Hanya program yang ACTIVE yang bisa di-upgrade' }, { status: 400 })
    }
    if (parsed.data.newPrograms.includes(current.program as any)) {
      return NextResponse.json(
        { error: 'Program baru tidak boleh sama dengan program aktif saat ini' },
        { status: 400 }
      )
    }
    const [, ...newEnrollments] = await prisma.$transaction([
      prisma.programEnrollment.update({
        where: { id },
        data: { status: 'UPGRADED', endedAt: new Date(), notes: parsed.data.notes },
      }),
      ...parsed.data.newPrograms.map(program =>
        prisma.programEnrollment.create({
          data: { studentId: current.studentId, program, status: 'ACTIVE' },
        })
      ),
    ])

    return NextResponse.json(newEnrollments, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
