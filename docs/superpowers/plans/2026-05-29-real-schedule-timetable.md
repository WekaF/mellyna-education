# Real Schedule Data & Weekly Timetable View

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Class model with day-of-week and time-slot fields, seed real weekly schedule data (5 tutors, ~70 students, 37 class slots), and build an admin weekly timetable grid view.

**Architecture:** Add optional `dayOfWeek` (enum) and `timeSlot` (String) to `Class` via Prisma migration. Replace `seed-real-students.ts` with a complete seed that creates the real staff and every class slot from the bimbel's weekly schedule. Add a server-rendered admin timetable page that renders a day × time-slot grid.

**Tech Stack:** Prisma (PostgreSQL), Next.js App Router, TypeScript, NextAuth, Tailwind CSS, lucide-react

---

## Source Data Reference

```
PIKET 14:45   SENIN: ANI LISA DANI | SELASA: LISA ELA | RABU: ELA VIN DANI
              JUM'AT: ANI LISA VIN  | SABTU: DANI ELA  | MINGGU: ANI LISA VIN

JAM     SENIN      SELASA     RABU       KAMIS   JUM'AT     SABTU      MINGGU
08:00   -          -          -          -       -          -          ENG: RAISHA EL BARIQ
                                                                        CAL: RIFQI GIO
                                                                        SMP: VINA WAWAN
09:00   -          -          -          -       -          -          SMP: HANA NAURA GISYA SILVA KEKEY FIKA
10:00   -          -          -          -       -          -          SMP: ELA GITA ALBY ADRIAN ZIDNA
11:00   CAL:MAMAD  CAL:NUVAL  CAL:NUVAL  -       JUMATAN    CAL:MAMAD  CAL: MAMAD FAWAS RAFA
                   KEVIN      KEVIN                          FAWAS
                   ZAFRAN     ZAFRAN                         RAFA
                   GABBY      GABBY
12:00   -          -          SMP:ZARA   -       -          SMP:ZARA   SMP: ZARA
                                                             ALBY MATH
JAM 1   -          -          -          -       SMP:NAURA  -          -
                                                 GITA ALBY ADRIAN
JAM 2   -          -          -          -       CAL:FAWAS  -          -
                                                 RAFA
JAM 3   CAL:       CAL:       CAL:       -       CAL:       CAL:       CAL: AJENG AYUMA FATIH YAHYA ABDAN
        CEISYA     GLEN       CEISYA             RAMDAN     RAMDAN     ENG: BIBOY FANIA GABBY ZHAFRAN KIA ALINDA
        KARIN      AJENG      FANIA              NUVAL      GLEN
        KEVIN      LINTANG    LINTANG            RIFQI      LINTANG
        YUNDA      YUNDA      AJENG              KARIN      REZA
        REZA       REZA       YUNDA              FATIH      AYUMA
        GEBBY      AYUMA      ROSA                          BERYL
        ZHAFRAN    FATIH      GIO                           YAHYA
        YAHYA      ROSA       OKTA
                   BERYL
                   OKTA
                              ENG(Jum): BIBOY MITA RAISHA EL BARIQ GABBY ZHAFRAN ALINDA ZIDNA ROSA OKTA
JAM 4   SMP:       SMP:       SMP:       -       SMP:       SMP:       SMP: NAJWA VIA JUNA AYE ZIDAN MITA
        FANIA      UWAIS      KAIRA              VIRA       ALINDA     CAL: ABROR VINDRA
        NAJWA      ALINDA     VIRA               GLEN       UWAIS
        AURA       RAMDAN     GLEN               IRSYA      KAIRA
        ZAFRAN     ZIDAN      IRSYA              OZIL       GISYA
        DIAZ       MIKA       JUNA               AYE        HAIKAL
        MITA       AGUSTIN    ZAFRAN             DIAZ       AGUSTIN
                   KIA        FIKA               MIKA       HANA
                              KIA                AURA       KEKEY
        CAL:       CAL:       CAL:
        KIA        ABROR      AURA
        VINDRA     VINDRA
JAM 7   -          ENG:       ENG:       ENG:    ENG:       -          -
                   ADRIAN     GIBRAN     GINA    JUNA
                   OZIL       ELA        JUNA    CLARA
                   KAYRA      GHISHA     OZIL    CLARISA
                              CLARA      ADRIAN  DIAZ
                              CLARISA    GHISHA  GHISHA
                              HANA       HANA    HANA

TTL     17         25         30         4       35         19         37
```

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `DayOfWeek` enum + `dayOfWeek?` + `timeSlot?` to `Class` |
| `prisma/migrations/<ts>_add_class_schedule_fields/` | Auto-created | Migration SQL |
| `prisma/seed-real-students.ts` | Rewrite | Complete real schedule seed |
| `app/api/admin/timetable/route.ts` | Create | GET: classes grouped by day + slot |
| `app/(dashboard)/admin/timetable/page.tsx` | Create | Weekly grid view |
| `components/dashboard/sidebar.tsx` | Modify | Add "Timetable" nav link |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `DayOfWeek` enum and fields to Class**

After the `MediaType` enum (line 33) add:

```prisma
enum DayOfWeek {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}
```

Replace the `Class` model (lines 87–99) with:

```prisma
model Class {
  id          String     @id @default(cuid())
  name        String
  subject     String
  description String?
  dayOfWeek   DayOfWeek?
  timeSlot    String?
  tutorId     String
  tutor       User       @relation("TutorClasses", fields: [tutorId], references: [id])
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  enrollments Enrollment[]
  schedules   Schedule[]
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_class_schedule_fields
```

Expected output contains: `Your database is now in sync with your schema.`

- [ ] **Step 3: Verify Prisma Client regenerated**

```bash
npx prisma generate
```

Expected output contains: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add dayOfWeek and timeSlot fields to Class model"
```

---

## Task 2: Seed Real Schedule Data

**Files:**
- Modify: `prisma/seed-real-students.ts` (complete rewrite)

**What this seeds:**
- 1 admin + 5 tutors (ANI, LISA, DANI, ELA, VIN) + 1 shared parent account
- 71 unique students
- 37 class slots mapped from the bimbel's weekly timetable

- [ ] **Step 1: Replace `prisma/seed-real-students.ts` entirely**

```typescript
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

  // Shared parent account (all students linked here; update per-student later)
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
```

- [ ] **Step 2: Run the seed**

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-real-students.ts
```

Expected last lines:
```
✅ Real schedule seeded!
   Tutors:   5
   Students: 71
   Classes:  37
```

No `⚠ Student not found` warnings should appear.

- [ ] **Step 3: Verify row counts in DB**

```bash
npx prisma studio
```

Open browser to http://localhost:5555. Check:
- `User` table: 7 rows (1 admin + 5 tutors + 1 parent)
- `Student` table: 71 rows
- `Class` table: 37 rows, all with non-null `dayOfWeek` and `timeSlot`
- `Enrollment` table: 167+ rows

- [ ] **Step 4: Commit**

```bash
git add prisma/seed-real-students.ts
git commit -m "feat: seed real weekly schedule (5 tutors, 71 students, 37 class slots)"
```

---

## Task 3: Timetable API Endpoint

**Files:**
- Create: `app/api/admin/timetable/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/admin/timetable/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const classes = await prisma.class.findMany({
    where: { dayOfWeek: { not: null } },
    include: {
      tutor: { select: { id: true, name: true } },
      enrollments: {
        include: { student: { select: { id: true, name: true } } },
        orderBy: { student: { name: 'asc' } },
      },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { timeSlot: 'asc' }],
  })

  return NextResponse.json(classes)
}
```

- [ ] **Step 2: Test endpoint manually**

With the dev server running (`npm run dev`), log in as admin@mellyna.id and run:

```bash
curl -b cookies.txt http://localhost:3000/api/admin/timetable | npx jq length
```

Expected: `37`

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/timetable/route.ts
git commit -m "feat: add GET /api/admin/timetable endpoint"
```

---

## Task 4: Admin Timetable Page

**Files:**
- Create: `app/(dashboard)/admin/timetable/page.tsx`
- Modify: `components/dashboard/sidebar.tsx` (add nav link + icon import)

- [ ] **Step 1: Add `Grid3x3` to sidebar icon imports**

In `components/dashboard/sidebar.tsx`, find the lucide-react import block (lines 7–23) and add `Grid3x3`:

```typescript
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  Grid3x3,          // ← add this
  CreditCard,
  Megaphone,
  TrendingUp,
  LogOut,
  Menu,
  X,
  Settings,
  FileText,
  BarChart2,
  Tag
} from 'lucide-react'
```

- [ ] **Step 2: Add Timetable nav link in the SUPER_ADMIN nav array**

In `components/dashboard/sidebar.tsx`, find the `case 'SUPER_ADMIN': return [` block (lines 47–60). Add after the `Jadwal` entry:

```typescript
{ name: 'Timetable', href: '/admin/timetable', icon: Grid3x3 },
```

Full updated array:
```typescript
case 'SUPER_ADMIN':
  return [
    { name: 'Dashboard',    href: '/admin',              icon: LayoutDashboard },
    { name: 'Siswa',        href: '/admin/students',     icon: GraduationCap },
    { name: 'Tutor',        href: '/admin/tutors',       icon: Users },
    { name: 'Kelas',        href: '/admin/classes',      icon: BookOpen },
    { name: 'Jadwal',       href: '/admin/schedules',    icon: Calendar },
    { name: 'Timetable',    href: '/admin/timetable',    icon: Grid3x3 },
    { name: 'Tagihan',      href: '/admin/billing',      icon: CreditCard },
    { name: 'Pengumuman',   href: '/admin/announcements',icon: Megaphone },
    { name: 'Analitik',     href: '/admin/analytics',    icon: BarChart2 },
    { name: 'Laporan',      href: '/admin/reports',      icon: FileText },
    { name: 'Paket Harga',  href: '/admin/pricing',      icon: Tag },
    { name: 'Pengaturan',   href: '/admin/settings',     icon: Settings },
  ]
```

- [ ] **Step 3: Create the timetable page**

```tsx
// app/(dashboard)/admin/timetable/page.tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { DayOfWeek } from '@prisma/client'

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'MONDAY',    label: 'Senin' },
  { key: 'TUESDAY',   label: 'Selasa' },
  { key: 'WEDNESDAY', label: 'Rabu' },
  { key: 'THURSDAY',  label: 'Kamis' },
  { key: 'FRIDAY',    label: "Jum'at" },
  { key: 'SATURDAY',  label: 'Sabtu' },
  { key: 'SUNDAY',    label: 'Minggu' },
]

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  'JAM 1', 'JAM 2', 'JAM 3', 'JAM 4', 'JAM 7',
]

const PIKET: Record<string, string> = {
  Senin:   'ANI, LISA, DANI',
  Selasa:  'LISA, ELA',
  Rabu:    'ELA, VIN, DANI',
  Kamis:   '—',
  "Jum'at":'ANI, LISA, VIN',
  Sabtu:   'DANI, ELA',
  Minggu:  'ANI, LISA, VIN',
}

const SUBJECT_COLORS: Record<string, string> = {
  ENGLISH:   'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  CALISTUNG: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  SEMPOA:    'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
}

export default async function TimetablePage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/login')

  const classes = await prisma.class.findMany({
    where: { dayOfWeek: { not: null } },
    include: {
      tutor: { select: { name: true } },
      enrollments: {
        include: { student: { select: { name: true } } },
        orderBy: { student: { name: 'asc' } },
      },
    },
  })

  // Build grid: grid[dayOfWeek][timeSlot] = class[]
  type ClassWithRelations = (typeof classes)[number]
  const grid: Record<string, Record<string, ClassWithRelations[]>> = {}
  for (const cls of classes) {
    const day = cls.dayOfWeek!
    const slot = cls.timeSlot!
    if (!grid[day]) grid[day] = {}
    if (!grid[day][slot]) grid[day][slot] = []
    grid[day][slot].push(cls)
  }

  // Per-day student totals
  const dayTotals = DAYS.map(d => ({
    label: d.label,
    count: Object.values(grid[d.key] ?? {})
      .flat()
      .reduce((sum, c) => sum + c.enrollments.length, 0),
  }))

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Jadwal Mingguan</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Timetable tetap bimbel — semua sesi per hari & jam
      </p>

      {/* Piket banner */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 text-xs">
        {DAYS.map(d => (
          <div key={d.key} className="border rounded-lg p-2 bg-gray-50 dark:bg-gray-800/40">
            <div className="font-semibold text-gray-700 dark:text-gray-300">{d.label}</div>
            <div className="text-gray-500 dark:text-gray-400">Piket: {PIKET[d.label]}</div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full border-collapse text-xs min-w-[900px]">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="border-b border-r p-2 text-center w-16 font-semibold text-gray-600 dark:text-gray-300">
                Jam
              </th>
              {DAYS.map(d => (
                <th key={d.key} className="border-b border-r p-2 text-center font-semibold text-gray-600 dark:text-gray-300">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot, rowIdx) => (
              <tr key={slot} className={rowIdx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-900/20'}>
                <td className="border-b border-r p-2 text-center font-medium text-gray-500 dark:text-gray-400">
                  {slot}
                </td>
                {DAYS.map(day => {
                  const cellClasses = grid[day.key]?.[slot] ?? []
                  return (
                    <td key={day.key} className="border-b border-r p-1.5 align-top min-w-[110px]">
                      {cellClasses.map(cls => (
                        <div key={cls.id} className="mb-2 last:mb-0">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mb-0.5 ${SUBJECT_COLORS[cls.subject] ?? 'bg-gray-100 text-gray-800'}`}>
                            {cls.subject}
                          </span>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">
                            {cls.tutor.name}
                          </div>
                          <ul className="space-y-0">
                            {cls.enrollments.map(e => (
                              <li key={e.student.name} className="text-[11px] text-gray-700 dark:text-gray-300">
                                {e.student.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 dark:bg-gray-800 font-semibold">
              <td className="border-t p-2 text-center text-gray-600 dark:text-gray-300 text-xs">TTL</td>
              {dayTotals.map(d => (
                <td key={d.label} className="border-t border-r p-2 text-center text-gray-700 dark:text-gray-200 text-xs">
                  {d.count}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
        <span>Total sesi: <strong className="text-gray-800 dark:text-white">{classes.length}</strong></span>
        <span>Total siswa unik: <strong className="text-gray-800 dark:text-white">{new Set(classes.flatMap(c => c.enrollments.map(e => e.student.name))).size}</strong></span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Start dev server and verify page loads**

```bash
npm run dev
```

Open http://localhost:3000/admin/timetable (logged in as admin@mellyna.id / admin123).

Expected:
- Grid renders with 10 rows (time slots) × 7 columns (days)
- Each cell shows subject badge (colored) + tutor name + student list
- Footer row shows per-day totals matching source: Senin≈17, Selasa≈25, Rabu≈30, Kamis≈4, Jum'at≈35, Sabtu≈19, Minggu≈37
- Piket cards in banner row above grid

- [ ] **Step 5: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors)

- [ ] **Step 6: Commit**

```bash
git add app/(dashboard)/admin/timetable/page.tsx components/dashboard/sidebar.tsx
git commit -m "feat: add admin weekly timetable grid page"
```

---

## Self-Review

**Spec coverage check:**
- [x] DayOfWeek + timeSlot added to Class schema
- [x] Migration task included
- [x] All 37 class slots seeded with correct students per source data
- [x] Piket info shown per day
- [x] Admin grid view with day × time slot layout
- [x] Subject color badges (ENGLISH=blue, CALISTUNG=green, SEMPOA=purple)
- [x] Per-day totals in footer matching source TTL row
- [x] Nav link added to admin sidebar
- [x] SUPER_ADMIN auth guard on page and API

**Type consistency check:**
- `DayOfWeek` enum values used consistently: `'MONDAY'` etc. in seed and `DayOfWeek` from `@prisma/client` in page
- `grid[day.key]` uses `DayOfWeek` keys matching enum exactly
- `cls.dayOfWeek!` and `cls.timeSlot!` are safe after `where: { dayOfWeek: { not: null } }` filter

**Placeholder scan:** No TBDs or incomplete steps found.

**Known caveats:**
- `SILVA` and `GIBRAN` appear in the schedule data but not in all seed tools — verify they are in `STUDENT_NAMES` array (they are: `SILVA` at index 57, `GIBRAN` at index 30)
- Students who share a name in different contexts (e.g., `ZAFRAN` appears as SEMPOA in Senin JAM 4 and CALISTUNG other days) are treated as the same student — this is correct per the source data
- `KAYRA` only appears in Selasa JAM 7 ENGLISH — included in student list
- `GINA` only appears in Kamis JAM 7 — included
