import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = (pw: string) => bcrypt.hash(pw, 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@mellyna.id' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@mellyna.id',
      password: await hash('admin123'),
      role: Role.SUPER_ADMIN,
      phone: '6281234567890',
    },
  })

  const tutor = await prisma.user.upsert({
    where: { email: 'tutor@mellyna.id' },
    update: {},
    create: {
      name: 'Pak Budi',
      email: 'tutor@mellyna.id',
      password: await hash('tutor123'),
      role: Role.TUTOR,
      phone: '6281234567891',
    },
  })

  const parent = await prisma.user.upsert({
    where: { email: 'parent@mellyna.id' },
    update: {},
    create: {
      name: 'Bu Sari',
      email: 'parent@mellyna.id',
      password: await hash('parent123'),
      role: Role.PARENT,
      phone: '6281234567892',
    },
  })

  const student = await prisma.student.upsert({
    where: { id: 'seed-student-1' },
    update: {},
    create: {
      id: 'seed-student-1',
      name: 'Andi Pratama',
      grade: 'Kelas 5 SD',
      parentId: parent.id,
    },
  })

  const kelas = await prisma.class.upsert({
    where: { id: 'seed-class-1' },
    update: {},
    create: {
      id: 'seed-class-1',
      name: 'Matematika Dasar',
      subject: 'Matematika',
      description: 'Kelas matematika untuk SD kelas 4-6',
      tutorId: tutor.id,
    },
  })

  await prisma.enrollment.upsert({
    where: { studentId_classId: { studentId: student.id, classId: kelas.id } },
    update: {},
    create: { studentId: student.id, classId: kelas.id },
  })

  console.log('[Mellyna Education] Seed complete:')
  console.table({ admin: admin.email, tutor: tutor.email, parent: parent.email })
}

main().catch(console.error).finally(() => prisma.$disconnect())
