import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'
import TimetableClient from './TimetableClient'

const DAY_ORDER: Record<string, number> = {
  'Senin': 1,
  'Selasa': 2,
  'Rabu': 3,
  'Kamis': 4,
  "Jum'at": 5,
  'Sabtu': 6,
  'Minggu': 7,
}

export default async function TimetablePage() {
  const [classesData, tutorsData, studentsData, piketData] = await Promise.all([
    // mirrors /api/classes GET for admin (no role filter)
    prisma.class.findMany({
      include: {
        tutor: { select: { id: true, name: true, email: true } },
        _count: { select: { enrollments: true } },
        programs: { select: { program: true } },
        enrollments: {
          include: {
            student: { select: { id: true, name: true, grade: true } },
          },
        },
        additionalTutors: {
          include: {
            tutor: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    // mirrors /api/tutors GET
    prisma.user.findMany({
      where: { role: Role.TUTOR },
      select: { id: true, name: true, email: true, phone: true, suspended: true, createdAt: true },
      orderBy: { name: 'asc' },
    }),
    // mirrors /api/students GET for admin (no role filter)
    prisma.student.findMany({
      include: { parent: { select: { name: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    // mirrors /api/admin/piket GET
    prisma.dailyPiket.findMany(),
  ])

  // Sort piket by day order
  piketData.sort((a, b) => (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99))

  // Filter tutors and students the same way the client did
  const activeTutors = tutorsData.filter(t => !t.suspended).map(t => ({
    id: t.id,
    name: t.name,
    suspended: t.suspended,
  }))
  const activeStudents = studentsData.filter(s => s.isActive).map(s => ({
    id: s.id,
    name: s.name,
    grade: s.grade,
    isActive: s.isActive,
  }))

  const piketList = piketData.map(p => ({ day: p.day, staff: p.staff }))

  return (
    <TimetableClient
      initialClasses={JSON.parse(JSON.stringify(classesData))}
      initialTutors={activeTutors}
      initialStudents={activeStudents}
      initialPiketList={piketList}
    />
  )
}
