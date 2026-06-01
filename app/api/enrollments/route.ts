import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const enrollSchema = z.object({
  studentId: z.string().min(1),
  classId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = enrollSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const activeProgramEnrollment = await prisma.programEnrollment.findFirst({
      where: { studentId: parsed.data.studentId, status: 'ACTIVE' },
    })

    if (!activeProgramEnrollment) {
      return NextResponse.json(
        { error: 'Siswa belum memiliki program aktif. Daftarkan program terlebih dahulu.' },
        { status: 422 }
      )
    }

    const classPrograms = await prisma.classProgram.findMany({
      where: { classId: parsed.data.classId },
      select: { program: true },
    })
    const classProgramList = classPrograms.map((cp) => cp.program)

    if (!classProgramList.includes(activeProgramEnrollment.program)) {
      return NextResponse.json(
        {
          error: `Kelas ini tidak termasuk program ${activeProgramEnrollment.program} yang aktif untuk siswa ini.`,
        },
        { status: 422 }
      )
    }

    const enrollment = await prisma.enrollment.upsert({
      where: {
        studentId_classId: { studentId: parsed.data.studentId, classId: parsed.data.classId },
      },
      update: {},
      create: {
        studentId: parsed.data.studentId,
        classId: parsed.data.classId,
        programEnrollmentId: activeProgramEnrollment.id,
      },
    })

    return NextResponse.json(enrollment, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
