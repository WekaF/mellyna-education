import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import ClassesClient from './ClassesClient'

export default async function AdminClassesPage() {
  const session = await getServerSession(authOptions)
  const [rawClasses, tutors, students, mainPrograms] = await Promise.all([
    prisma.class.findMany({
      include: {
        tutor: { select: { name: true, email: true } },
        _count: { select: { enrollments: true } },
        programs: { select: { program: true } },
        enrollments: {
          include: {
            student: { select: { id: true, name: true, grade: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where: { role: 'TUTOR' },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    prisma.student.findMany({
      select: { id: true, name: true, grade: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.mainProgram.findMany({
      select: { code: true, name: true, isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    }),
  ])

  const classes = rawClasses.map((cls) => ({
    id: cls.id,
    name: cls.name,
    mainProgram: cls.mainProgram,
    description: cls.description,
    tutor: cls.tutor,
    _count: cls._count,
    programs: cls.programs,
    enrollments: cls.enrollments.map((enr) => ({
      id: enr.id,
      student: enr.student,
    })),
  }))

  return (
    <ClassesClient
      initialClasses={classes}
      initialTutors={tutors}
      initialStudents={students}
      mainPrograms={mainPrograms}
      canManageMainPrograms={(session?.user as any)?.role === 'SUPER_ADMIN'}
    />
  )
}
