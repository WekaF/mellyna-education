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

  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = enrollSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    // Get ALL active program enrollments for this student
    const activeProgramEnrollments = await prisma.programEnrollment.findMany({
      where: { studentId: parsed.data.studentId, status: 'ACTIVE' },
    })

    if (activeProgramEnrollments.length === 0) {
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

    // Find the first active program enrollment that matches any of the class programs
    const matchingEnrollment = activeProgramEnrollments.find((pe) =>
      classProgramList.includes(pe.program)
    )

    if (!matchingEnrollment) {
      const studentPrograms = activeProgramEnrollments.map((pe) => pe.program).join(', ')
      return NextResponse.json(
        {
          error: `Program aktif siswa (${studentPrograms}) tidak cocok dengan program kelas ini (${classProgramList.join(', ')}).`,
        },
        { status: 422 }
      )
    }

    const enrollment = await prisma.enrollment.upsert({
      where: {
        studentId_classId: { studentId: parsed.data.studentId, classId: parsed.data.classId },
      },
      update: { programEnrollmentId: matchingEnrollment.id },
      create: {
        studentId: parsed.data.studentId,
        classId: parsed.data.classId,
        programEnrollmentId: matchingEnrollment.id,
      },
    })

    return NextResponse.json(enrollment, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
