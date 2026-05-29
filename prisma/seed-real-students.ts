import { PrismaClient, Role, DayOfWeek } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const hash = (pw: string) => bcrypt.hash(pw, 12)

// ─── Tutors ────────────────────────────────────────────────────────────────
const TUTORS = [
  { slug: 'ANI',  name: 'Ani',  email: 'ani@mellyna.id',  phone: '628111000001' },
  { slug: 'LISA', name: 'Lisa', email: 'lisa@mellyna.id', phone: '628111000002' },
  { slug: 'DANI', name: 'Dani', email: 'dani@mellyna.id', phone: '628111000003' },
  { slug: 'ELA',  name: 'Ela',  email: 'ela@mellyna.id',  phone: '628111000004' },
  { slug: 'VIN',  name: 'Vin',  email: 'vin@mellyna.id',  phone: '628111000005' },
]

// ─── All unique student names ───────────────────────────────────────────────
const STUDENT_NAMES = [
  'ABDAN', 'ABROR', 'ADRIAN', 'AGUSTIN', 'AJENG', 'ALBY', 'ALINDA', 'AYE',
  'AYUMA', 'AURA', 'BERYL', 'BIBOY', 'CEISYA', 'CLARA', 'CLARISA',
  'DIAZ', 'EL BARIQ', 'ELA', 'FANIA', 'FATIH', 'FAWAS', 'FIKA', 'GABBY',
  'GEBBY', 'GHISHA', 'GIO', 'GINA', 'GISYA', 'GITA', 'GIBRAN', 'GLEN',
  'HAIKAL', 'HANA', 'IRSYA', 'JUNA', 'KAIRA', 'KARIN', 'KAYRA', 'KEKEY',
  'KEVIN', 'KIA', 'LINTANG', 'MAMAD', 'MIKA', 'MITA', 'NAJWA', 'NAURA',
  'NUVAL', 'OKTA', 'OZIL', 'RAFA', 'RAMDAN', 'RAISHA', 'REZA', 'RIFQI',
  'ROSA', 'SILVA', 'UWAIS', 'VIA', 'VINA', 'VINDRA', 'VIRA', 'WAWAN',
  'YAHYA', 'YUNDA', 'ZAFRAN', 'ZARA', 'ZHAFRAN', 'ZIDAN', 'ZIDNA',
]

// ─── Weekly class slots ─────────────────────────────────────────────────────
type ClassSlot = {
  day: DayOfWeek
  time: string
  subject: string
  tutor: string
  students: string[]
}

const CLASS_SLOTS: ClassSlot[] = [
  // ── SENIN ──
  { day: 'MONDAY', time: '11:00', subject: 'CALISTUNG', tutor: 'DANI',
    students: ['MAMAD'] },
  { day: 'MONDAY', time: 'JAM 3', subject: 'CALISTUNG', tutor: 'LISA',
    students: ['CEISYA','KARIN','KEVIN','YUNDA','REZA','GEBBY','ZHAFRAN','YAHYA'] },
  { day: 'MONDAY', time: 'JAM 4', subject: 'SEMPOA',    tutor: 'ANI',
    students: ['FANIA','NAJWA','AURA','ZAFRAN','DIAZ','MITA'] },
  { day: 'MONDAY', time: 'JAM 4', subject: 'CALISTUNG', tutor: 'DANI',
    students: ['KIA','VINDRA'] },

  // ── SELASA ──
  { day: 'TUESDAY', time: '11:00', subject: 'CALISTUNG', tutor: 'LISA',
    students: ['NUVAL','KEVIN','ZAFRAN','GABBY'] },
  { day: 'TUESDAY', time: 'JAM 3', subject: 'CALISTUNG', tutor: 'ELA',
    students: ['GLEN','AJENG','LINTANG','YUNDA','REZA','AYUMA','FATIH','ROSA','BERYL','OKTA'] },
  { day: 'TUESDAY', time: 'JAM 4', subject: 'SEMPOA',    tutor: 'LISA',
    students: ['UWAIS','ALINDA','RAMDAN','ZIDAN','MIKA','AGUSTIN','KIA'] },
  { day: 'TUESDAY', time: 'JAM 4', subject: 'CALISTUNG', tutor: 'ELA',
    students: ['ABROR','VINDRA'] },
  { day: 'TUESDAY', time: 'JAM 7', subject: 'ENGLISH',   tutor: 'LISA',
    students: ['ADRIAN','OZIL','KAYRA'] },

  // ── RABU ──
  { day: 'WEDNESDAY', time: '11:00', subject: 'CALISTUNG', tutor: 'ELA',
    students: ['NUVAL','KEVIN','ZAFRAN','GABBY'] },
  { day: 'WEDNESDAY', time: '12:00', subject: 'SEMPOA',    tutor: 'VIN',
    students: ['ZARA'] },
  { day: 'WEDNESDAY', time: 'JAM 3', subject: 'CALISTUNG', tutor: 'DANI',
    students: ['CEISYA','FANIA','LINTANG','AJENG','YUNDA','ROSA','GIO','OKTA'] },
  { day: 'WEDNESDAY', time: 'JAM 4', subject: 'SEMPOA',    tutor: 'ELA',
    students: ['KAIRA','VIRA','GLEN','IRSYA','JUNA','ZAFRAN','FIKA','KIA'] },
  { day: 'WEDNESDAY', time: 'JAM 4', subject: 'CALISTUNG', tutor: 'VIN',
    students: ['AURA'] },
  { day: 'WEDNESDAY', time: 'JAM 7', subject: 'ENGLISH',   tutor: 'DANI',
    students: ['GIBRAN','ELA','GHISHA','CLARA','CLARISA','HANA'] },

  // ── KAMIS ──
  { day: 'THURSDAY', time: 'JAM 7', subject: 'ENGLISH', tutor: 'ANI',
    students: ['GINA','JUNA','OZIL','ADRIAN','GHISHA','HANA'] },

  // ── JUM'AT ──
  { day: 'FRIDAY', time: 'JAM 1', subject: 'SEMPOA',    tutor: 'ANI',
    students: ['NAURA','GITA','ALBY','ADRIAN'] },
  { day: 'FRIDAY', time: 'JAM 2', subject: 'CALISTUNG', tutor: 'LISA',
    students: ['FAWAS','RAFA'] },
  { day: 'FRIDAY', time: 'JAM 3', subject: 'CALISTUNG', tutor: 'ANI',
    students: ['RAMDAN','NUVAL','RIFQI','KARIN','FATIH'] },
  { day: 'FRIDAY', time: 'JAM 3', subject: 'ENGLISH',   tutor: 'VIN',
    students: ['BIBOY','MITA','RAISHA','EL BARIQ','GABBY','ZHAFRAN','ALINDA','ZIDNA','ROSA','OKTA'] },
  { day: 'FRIDAY', time: 'JAM 4', subject: 'SEMPOA',    tutor: 'ANI',
    students: ['VIRA','GLEN','IRSYA','OZIL','AYE','DIAZ','MIKA','AURA'] },
  { day: 'FRIDAY', time: 'JAM 7', subject: 'ENGLISH',   tutor: 'LISA',
    students: ['JUNA','CLARA','OZIL','ADRIAN','GHISHA','HANA','CLARISA','DIAZ'] },

  // ── SABTU ──
  { day: 'SATURDAY', time: '12:00', subject: 'SEMPOA',    tutor: 'DANI',
    students: ['ZARA','ALBY'] },
  { day: 'SATURDAY', time: 'JAM 3', subject: 'CALISTUNG', tutor: 'ELA',
    students: ['RAMDAN','GLEN','LINTANG','REZA','AYUMA','BERYL','YAHYA'] },
  { day: 'SATURDAY', time: 'JAM 4', subject: 'SEMPOA',    tutor: 'DANI',
    students: ['ALINDA','UWAIS','KAIRA','GISYA','HAIKAL','AGUSTIN','HANA','KEKEY'] },
  { day: 'SATURDAY', time: 'JAM 4', subject: 'CALISTUNG', tutor: 'ELA',
    students: ['ABROR','VINDRA'] },

  // ── MINGGU ──
  { day: 'SUNDAY', time: '08:00', subject: 'ENGLISH',   tutor: 'ANI',
    students: ['RAISHA','EL BARIQ'] },
  { day: 'SUNDAY', time: '08:00', subject: 'CALISTUNG', tutor: 'LISA',
    students: ['RIFQI','GIO'] },
  { day: 'SUNDAY', time: '08:00', subject: 'SEMPOA',    tutor: 'VIN',
    students: ['VINA','WAWAN'] },
  { day: 'SUNDAY', time: '09:00', subject: 'SEMPOA',    tutor: 'ANI',
    students: ['HANA','NAURA','GISYA','SILVA','KEKEY','FIKA'] },
  { day: 'SUNDAY', time: '10:00', subject: 'SEMPOA',    tutor: 'LISA',
    students: ['ELA','GITA','ALBY','ADRIAN','ZIDNA'] },
  { day: 'SUNDAY', time: '11:00', subject: 'CALISTUNG', tutor: 'VIN',
    students: ['MAMAD','FAWAS','RAFA'] },
  { day: 'SUNDAY', time: '12:00', subject: 'SEMPOA',    tutor: 'ANI',
    students: ['ZARA'] },
  { day: 'SUNDAY', time: 'JAM 3', subject: 'CALISTUNG', tutor: 'LISA',
    students: ['AJENG','AYUMA','FATIH','YAHYA','ABDAN'] },
  { day: 'SUNDAY', time: 'JAM 3', subject: 'ENGLISH',   tutor: 'VIN',
    students: ['BIBOY','FANIA','GABBY','ZHAFRAN','KIA','ALINDA'] },
  { day: 'SUNDAY', time: 'JAM 4', subject: 'SEMPOA',    tutor: 'ANI',
    students: ['NAJWA','VIA','JUNA','AYE','ZIDAN','MITA'] },
  { day: 'SUNDAY', time: 'JAM 4', subject: 'CALISTUNG', tutor: 'LISA',
    students: ['ABROR','VINDRA'] },
]

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const tutorPassword = await hash('tutor123')
  const adminPassword = await hash('admin123')
  const parentPassword = await hash('parent123')

  console.log('Wiping all tables...')
  await prisma.media.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.scheduleParticipant.deleteMany()
  await prisma.attendance.deleteMany()
  await prisma.learningReport.deleteMany()
  await prisma.enrollment.deleteMany()
  await prisma.student.deleteMany()
  await prisma.schedule.deleteMany()
  await prisma.class.deleteMany()
  await prisma.announcement.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()

  // Admin
  await prisma.user.create({
    data: { name: 'Super Admin', email: 'admin@mellyna.id', password: adminPassword, role: Role.SUPER_ADMIN, phone: '628000000000' }
  })

  // Tutors
  const tutorMap: Record<string, string> = {}
  for (const t of TUTORS) {
    const u = await prisma.user.create({
      data: { name: t.name, email: t.email, password: tutorPassword, role: Role.TUTOR, phone: t.phone }
    })
    tutorMap[t.slug] = u.id
  }

  // Shared parent account
  const defaultParent = await prisma.user.create({
    data: { name: 'Admin Bimbel', email: 'parent@mellyna.id', password: parentPassword, role: Role.PARENT, phone: '628000000001' }
  })

  // Students
  console.log(`Seeding ${STUDENT_NAMES.length} students...`)
  const studentMap: Record<string, string> = {}
  for (const name of STUDENT_NAMES) {
    const s = await prisma.student.create({ data: { name, parentId: defaultParent.id } })
    studentMap[name] = s.id
  }

  // Classes + Enrollments
  console.log(`Seeding ${CLASS_SLOTS.length} class slots...`)
  const DAY_LABEL: Record<DayOfWeek, string> = {
    MONDAY: 'Senin', TUESDAY: 'Selasa', WEDNESDAY: 'Rabu',
    THURSDAY: 'Kamis', FRIDAY: "Jum'at", SATURDAY: 'Sabtu', SUNDAY: 'Minggu',
  }
  for (const slot of CLASS_SLOTS) {
    const cls = await prisma.class.create({
      data: {
        name: `${slot.subject} ${DAY_LABEL[slot.day]} ${slot.time}`,
        subject: slot.subject,
        dayOfWeek: slot.day,
        timeSlot: slot.time,
        tutorId: tutorMap[slot.tutor],
      }
    })
    for (const studentName of slot.students) {
      const studentId = studentMap[studentName]
      if (!studentId) { console.warn(`  ⚠ Student not found: "${studentName}"`); continue }
      await prisma.enrollment.upsert({
        where: { studentId_classId: { studentId, classId: cls.id } },
        update: {},
        create: { studentId, classId: cls.id },
      })
    }
  }

  console.log('✅ Real schedule seeded!')
  console.log(`   Tutors:   ${TUTORS.length}`)
  console.log(`   Students: ${STUDENT_NAMES.length}`)
  console.log(`   Classes:  ${CLASS_SLOTS.length}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
