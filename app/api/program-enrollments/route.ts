import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const createSchema = z.object({
  studentId: z.string().min(1),
  program: z.enum(['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH']),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id

  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId')

  let where: any = studentId ? { studentId } : {}

  if (role === 'PARENT') {
    where = { ...where, student: { parentId: userId } }
  }

  try {
    const enrollments = await prisma.programEnrollment.findMany({
      where,
      include: { student: { select: { name: true } } },
      orderBy: { startedAt: 'desc' },
      take: 100,
    })

    return NextResponse.json(enrollments)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const existingActive = await prisma.programEnrollment.findFirst({
      where: { studentId: parsed.data.studentId, status: 'ACTIVE' },
    })
    if (existingActive) {
      return NextResponse.json(
        { error: 'Siswa sudah memiliki program aktif. Gunakan endpoint upgrade untuk ganti program.' },
        { status: 409 }
      )
    }

    const enrollment = await prisma.programEnrollment.create({
      data: parsed.data,
    })

    return NextResponse.json(enrollment, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
