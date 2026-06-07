# Program Enrollment Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memisahkan "pendaftaran program" dari "pendaftaran kelas" sehingga setiap siswa hanya bisa aktif di satu program sekaligus, dengan alur upgrade yang jelas.

**Architecture:** Tambah model `ProgramEnrollment` sebagai layer baru antara Student dan Enrollment (Student→Class). Constraint "satu program aktif" diterapkan di application layer saat create/upgrade ProgramEnrollment. Enrollment ke kelas hanya bisa dilakukan jika siswa punya ProgramEnrollment ACTIVE.

**Tech Stack:** Next.js 15, Prisma ORM, PostgreSQL, Zod, NextAuth v5

---

## Penjelasan Flow Baru

```
1. Admin input Parent (User PARENT) → hanya data akun, tidak pilih program
2. Admin input Student → hanya data anak, terhubung ke parent, tidak pilih program
3. Admin/Parent pilih Program untuk Student → buat ProgramEnrollment (status: ACTIVE)
4. Admin assign Student ke Class → buat Enrollment (harus ada ProgramEnrollment ACTIVE)
5. Student ikut kelas sesuai Schedule
6. Upgrade program → ProgramEnrollment lama = UPGRADED + endedAt, buat ProgramEnrollment baru = ACTIVE
```

## Aturan Bisnis

- Satu siswa **hanya boleh** punya 1 `ProgramEnrollment` dengan `status = ACTIVE`
- Untuk ganti program: operasi "upgrade" (atomic transaction)
- `Enrollment` ke kelas hanya bisa dibuat jika siswa punya `ProgramEnrollment ACTIVE`
- Program di kelas (`ClassProgram`) harus cocok dengan program aktif siswa
- Parent baru dibuat tanpa pilih apapun → program dipilih di langkah terpisah

## Diagram Relasi

```
User (role=PARENT)
  └── Student
        ├── ProgramEnrollment[]  ← baru
        │     ├── status: ACTIVE | COMPLETED | UPGRADED | DROPPED
        │     ├── program: SEMPOA | AHE | EFK | ...
        │     └── startedAt / endedAt
        └── Enrollment[]
              ├── class: Class
              └── programEnrollmentId → ProgramEnrollment  ← baru
```

---

## File Structure

**Baru:**
- `prisma/schema.prisma` — tambah enum `ProgramEnrollmentStatus` dan model `ProgramEnrollment`
- `prisma/migrations/[timestamp]_add_program_enrollment/` — migration SQL
- `app/api/program-enrollments/route.ts` — GET list + POST create
- `app/api/program-enrollments/[id]/route.ts` — GET detail + PATCH upgrade/complete + DELETE
- `app/api/program-enrollments/[id]/upgrade/route.ts` — POST upgrade ke program baru
- `components/admin/ProgramEnrollmentBadge.tsx` — badge status program aktif

**Dimodifikasi:**
- `app/api/enrollments/route.ts` — validasi programEnrollmentId sebelum enroll ke kelas
- `app/api/students/route.ts` — include programEnrollments di response GET
- `app/(dashboard)/admin/parents/ParentsClient.tsx` — tampilkan program aktif per student

---

## Task 1: Schema — Tambah ProgramEnrollment

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Tambah enum ProgramEnrollmentStatus di schema.prisma**

Tambahkan setelah enum `InvoiceStatus`:

```prisma
enum ProgramEnrollmentStatus {
  ACTIVE
  COMPLETED
  UPGRADED
  DROPPED
}
```

- [ ] **Step 2: Tambah model ProgramEnrollment di schema.prisma**

Tambahkan setelah model `Enrollment`:

```prisma
model ProgramEnrollment {
  id          String                  @id @default(cuid())
  studentId   String
  program     Program
  status      ProgramEnrollmentStatus @default(ACTIVE)
  startedAt   DateTime                @default(now())
  endedAt     DateTime?
  notes       String?
  createdAt   DateTime                @default(now())
  updatedAt   DateTime                @updatedAt

  student     Student      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  enrollments Enrollment[]

  @@index([studentId, status])
}
```

- [ ] **Step 3: Modifikasi model Student — tambah relasi ke ProgramEnrollment**

Di dalam model `Student`, tambahkan setelah `enrollments Enrollment[]`:

```prisma
  programEnrollments ProgramEnrollment[]
```

- [ ] **Step 4: Modifikasi model Enrollment — tambah relasi ke ProgramEnrollment**

Ubah model `Enrollment` menjadi:

```prisma
model Enrollment {
  id                  String             @id @default(cuid())
  studentId           String
  classId             String
  programEnrollmentId String?
  student             Student            @relation(fields: [studentId], references: [id])
  class               Class              @relation(fields: [classId], references: [id])
  programEnrollment   ProgramEnrollment? @relation(fields: [programEnrollmentId], references: [id])
  joinedAt            DateTime           @default(now())

  @@unique([studentId, classId])
}
```

> `programEnrollmentId` dibuat optional (`?`) agar enrollment lama tidak break.

- [ ] **Step 5: Generate dan jalankan migration**

```bash
cd /Users/weka/project/mellyna-education
npx prisma migrate dev --name add_program_enrollment
```

Expected: migration berhasil, tabel `ProgramEnrollment` terbuat di database.

- [ ] **Step 6: Verifikasi Prisma Client ter-regenerate**

```bash
npx prisma studio
```

Cek tabel `ProgramEnrollment` muncul di Prisma Studio.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add ProgramEnrollment model to track student active program"
```

---

## Task 2: API — CRUD ProgramEnrollment

**Files:**
- Create: `app/api/program-enrollments/route.ts`
- Create: `app/api/program-enrollments/[id]/route.ts`
- Create: `app/api/program-enrollments/[id]/upgrade/route.ts`

- [ ] **Step 1: Buat file `app/api/program-enrollments/route.ts`**

```typescript
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

  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId')

  const where = studentId ? { studentId } : {}

  const enrollments = await prisma.programEnrollment.findMany({
    where,
    include: { student: { select: { name: true } } },
    orderBy: { startedAt: 'desc' },
  })

  return NextResponse.json(enrollments)
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

  // Cek apakah sudah ada program ACTIVE
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
}
```

- [ ] **Step 2: Buat file `app/api/program-enrollments/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const patchSchema = z.object({
  status: z.enum(['COMPLETED', 'DROPPED']),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const enrollment = await prisma.programEnrollment.findUnique({
    where: { id: params.id },
    include: {
      student: { select: { name: true, parent: { select: { name: true } } } },
      enrollments: { include: { class: { select: { name: true } } } },
    },
  })

  if (!enrollment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(enrollment)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await prisma.programEnrollment.update({
    where: { id: params.id },
    data: {
      status: parsed.data.status,
      notes: parsed.data.notes,
      endedAt: new Date(),
    },
  })

  return NextResponse.json(updated)
}
```

- [ ] **Step 3: Buat file `app/api/program-enrollments/[id]/upgrade/route.ts`**

Ini adalah operasi atomik: tutup program lama, buka program baru.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const upgradeSchema = z.object({
  newProgram: z.enum(['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH']),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = upgradeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const current = await prisma.programEnrollment.findUnique({ where: { id: params.id } })
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (current.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Hanya program yang ACTIVE yang bisa di-upgrade' }, { status: 400 })
  }

  const [, newEnrollment] = await prisma.$transaction([
    prisma.programEnrollment.update({
      where: { id: params.id },
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
```

- [ ] **Step 4: Test endpoint create**

```bash
# Asumsikan ada studentId yang valid
curl -X POST http://localhost:3000/api/program-enrollments \
  -H "Content-Type: application/json" \
  -d '{"studentId":"<id>","program":"SEMPOA"}'
```

Expected: `{ id: "...", program: "SEMPOA", status: "ACTIVE", ... }`

- [ ] **Step 5: Test conflict — create kedua kali harus error 409**

```bash
curl -X POST http://localhost:3000/api/program-enrollments \
  -H "Content-Type: application/json" \
  -d '{"studentId":"<id>","program":"AHE"}'
```

Expected: `{ error: "Siswa sudah memiliki program aktif..." }` dengan status 409

- [ ] **Step 6: Commit**

```bash
git add app/api/program-enrollments/
git commit -m "feat: add program-enrollments API endpoints with one-active constraint"
```

---

## Task 3: Update Enrollment API — Validasi Program Aktif

**Files:**
- Modify: `app/api/enrollments/route.ts`

- [ ] **Step 1: Update enrollSchema untuk terima programEnrollmentId (optional)**

Buka `app/api/enrollments/route.ts` dan ganti schema + POST handler:

```typescript
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

  // Cari program aktif siswa
  const activeProgramEnrollment = await prisma.programEnrollment.findFirst({
    where: { studentId: parsed.data.studentId, status: 'ACTIVE' },
  })

  if (!activeProgramEnrollment) {
    return NextResponse.json(
      { error: 'Siswa belum memiliki program aktif. Daftarkan program terlebih dahulu.' },
      { status: 422 }
    )
  }

  // Cek apakah program kelas cocok dengan program aktif siswa
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
}
```

- [ ] **Step 2: Test enrollment tanpa program aktif**

```bash
curl -X POST http://localhost:3000/api/enrollments \
  -H "Content-Type: application/json" \
  -d '{"studentId":"<id-tanpa-program>","classId":"<classId>"}'
```

Expected: `{ error: "Siswa belum memiliki program aktif..." }` status 422

- [ ] **Step 3: Test enrollment dengan program aktif ke kelas yang salah program**

```bash
# Student ACTIVE di SEMPOA, coba enroll ke kelas EFK
curl -X POST http://localhost:3000/api/enrollments \
  -H "Content-Type: application/json" \
  -d '{"studentId":"<id-sempoa>","classId":"<classId-efk>"}'
```

Expected: `{ error: "Kelas ini tidak termasuk program SEMPOA..." }` status 422

- [ ] **Step 4: Test enrollment sukses**

```bash
# Student ACTIVE di SEMPOA, enroll ke kelas SEMPOA
curl -X POST http://localhost:3000/api/enrollments \
  -H "Content-Type: application/json" \
  -d '{"studentId":"<id-sempoa>","classId":"<classId-sempoa>"}'
```

Expected: `{ id: "...", studentId: "...", classId: "...", programEnrollmentId: "..." }` status 201

- [ ] **Step 5: Commit**

```bash
git add app/api/enrollments/route.ts
git commit -m "feat: validate active program enrollment before enrolling student to class"
```

---

## Task 4: Update Students API — Include Program Aktif

**Files:**
- Modify: `app/api/students/route.ts`

- [ ] **Step 1: Update GET handler untuk include programEnrollments**

Ubah query di `GET` handler (role PARENT dan default):

```typescript
// Untuk PARENT:
students = await prisma.student.findMany({
  where: { parentId: userId },
  include: {
    parent: { select: { name: true, email: true, phone: true } },
    programEnrollments: {
      where: { status: 'ACTIVE' },
      select: { id: true, program: true, status: true, startedAt: true },
    },
  },
  orderBy: { createdAt: 'desc' },
})

// Untuk SUPER_ADMIN/TUTOR:
students = await prisma.student.findMany({
  include: {
    parent: { select: { name: true, email: true, phone: true } },
    programEnrollments: {
      where: { status: 'ACTIVE' },
      select: { id: true, program: true, status: true, startedAt: true },
    },
  },
  orderBy: { createdAt: 'desc' },
})
```

- [ ] **Step 2: Test GET /api/students**

```bash
curl http://localhost:3000/api/students
```

Expected: setiap student punya field `programEnrollments: [{ program: "SEMPOA", status: "ACTIVE", ... }]` atau `programEnrollments: []` jika belum ada program.

- [ ] **Step 3: Commit**

```bash
git add app/api/students/route.ts
git commit -m "feat: include active program enrollment in students API response"
```

---

## Task 5: UI Admin — Tampilkan Program Aktif di Parents Page

**Files:**
- Create: `components/admin/ProgramEnrollmentBadge.tsx`
- Modify: `app/(dashboard)/admin/parents/ParentsClient.tsx`

- [ ] **Step 1: Buat komponen badge `components/admin/ProgramEnrollmentBadge.tsx`**

```typescript
import React from 'react'

const PROGRAM_COLORS: Record<string, string> = {
  SEMPOA:   'bg-purple-100 text-purple-800',
  AHE:      'bg-blue-100 text-blue-800',
  EFK:      'bg-green-100 text-green-800',
  EYL:      'bg-teal-100 text-teal-800',
  EFE:      'bg-cyan-100 text-cyan-800',
  CALISTUNG:'bg-orange-100 text-orange-800',
  ENGLISH:  'bg-indigo-100 text-indigo-800',
}

interface ProgramEnrollmentBadgeProps {
  program?: string | null
}

export function ProgramEnrollmentBadge({ program }: ProgramEnrollmentBadgeProps) {
  if (!program) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
        Belum ada program
      </span>
    )
  }

  const color = PROGRAM_COLORS[program] ?? 'bg-gray-100 text-gray-800'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {program}
    </span>
  )
}
```

- [ ] **Step 2: Update interface Student di ParentsClient.tsx**

Cari interface `Student` di `ParentsClient.tsx` (sekitar baris 75) dan tambahkan:

```typescript
interface ProgramEnrollmentInfo {
  id: string
  program: string
  status: string
  startedAt: string
}

interface Student {
  id: string
  name: string
  grade: string | null
  notes: string | null
  isActive: boolean
  programEnrollments: ProgramEnrollmentInfo[]  // tambahkan ini
  enrollments: Enrollment[]
  attendances: Attendance[]
  reports: LearningReport[]
  invoices: Invoice[]
}
```

- [ ] **Step 3: Tampilkan badge program di list student dalam ParentsClient.tsx**

Cari bagian rendering student list (di dalam modal detail parent) dan tambahkan badge:

```tsx
import { ProgramEnrollmentBadge } from '@/components/admin/ProgramEnrollmentBadge'

// Di dalam rendering setiap student:
<div className="flex items-center gap-2">
  <span>{student.name}</span>
  <ProgramEnrollmentBadge
    program={student.programEnrollments[0]?.program ?? null}
  />
</div>
```

- [ ] **Step 4: Tambah tombol "Daftarkan Program" jika siswa belum punya program aktif**

Di dalam detail student (masih di ParentsClient.tsx), tambahkan conditional UI:

```tsx
{student.programEnrollments.length === 0 && (
  <button
    onClick={() => handleAssignProgram(student.id)}
    className="text-sm text-blue-600 hover:underline"
  >
    + Daftarkan Program
  </button>
)}
```

Dan handler-nya:

```typescript
const handleAssignProgram = async (studentId: string) => {
  const program = prompt('Masukkan nama program (SEMPOA/AHE/EFK/EYL/EFE/CALISTUNG/ENGLISH):')
  if (!program) return
  
  const res = await fetch('/api/program-enrollments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, program: program.toUpperCase() }),
  })
  
  if (res.ok) {
    // refresh data
    fetchParents()
  } else {
    const err = await res.json()
    alert(err.error)
  }
}
```

> Catatan: `prompt()` adalah implementasi sementara. Idealnya gunakan modal/dialog yang proper.

- [ ] **Step 5: Update fetch di ParentsClient.tsx untuk include programEnrollments**

Cari bagian fetch student data dan tambahkan field `programEnrollments` di query/response handler.

- [ ] **Step 6: Commit**

```bash
git add components/admin/ProgramEnrollmentBadge.tsx \
        app/(dashboard)/admin/parents/ParentsClient.tsx
git commit -m "feat: show active program badge and assign program button in admin parents page"
```

---

## Task 6: Upgrade Program UI

**Files:**
- Modify: `app/(dashboard)/admin/parents/ParentsClient.tsx`

- [ ] **Step 1: Tambah tombol "Upgrade Program" untuk siswa yang sudah punya program aktif**

```tsx
{student.programEnrollments.length > 0 && (
  <button
    onClick={() => handleUpgradeProgram(student.programEnrollments[0].id)}
    className="text-sm text-amber-600 hover:underline"
  >
    Upgrade Program
  </button>
)}
```

- [ ] **Step 2: Tambah handler upgrade**

```typescript
const handleUpgradeProgram = async (programEnrollmentId: string) => {
  const newProgram = prompt('Masukkan program baru (SEMPOA/AHE/EFK/EYL/EFE/CALISTUNG/ENGLISH):')
  if (!newProgram) return
  
  const notes = prompt('Catatan upgrade (opsional):') ?? undefined
  
  const res = await fetch(`/api/program-enrollments/${programEnrollmentId}/upgrade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newProgram: newProgram.toUpperCase(), notes }),
  })
  
  if (res.ok) {
    fetchParents()
  } else {
    const err = await res.json()
    alert(err.error)
  }
}
```

- [ ] **Step 3: Test upgrade flow**

1. Buka admin → Parents
2. Pilih parent → lihat student
3. Pastikan badge program muncul
4. Klik "Upgrade Program"
5. Masukkan program baru
6. Verifikasi badge berubah ke program baru

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/admin/parents/ParentsClient.tsx
git commit -m "feat: add upgrade program flow in admin parents page"
```

---

## Task 7: Parent Dashboard — Tampilkan Program Aktif Anak

**Files:**
- Modify: `app/(dashboard)/parent/page.tsx`

- [ ] **Step 1: Baca file parent dashboard**

Baca `app/(dashboard)/parent/page.tsx` untuk memahami struktur saat ini.

- [ ] **Step 2: Include programEnrollments di query student untuk parent**

API `/api/students` sudah diupdate di Task 4 untuk include programEnrollments. Pastikan parent dashboard membaca field ini.

- [ ] **Step 3: Tampilkan program aktif di kartu anak**

```tsx
import { ProgramEnrollmentBadge } from '@/components/admin/ProgramEnrollmentBadge'

// Di dalam kartu setiap anak:
<div className="flex items-center gap-2 mt-1">
  <ProgramEnrollmentBadge
    program={student.programEnrollments?.[0]?.program ?? null}
  />
</div>
```

- [ ] **Step 4: Test parent view**

Login sebagai parent → dashboard → pastikan badge program aktif anak tampil.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/parent/page.tsx
git commit -m "feat: show active program on parent dashboard student cards"
```

---

## Self-Review Checklist

### Spec Coverage
- [x] Parent buat akun → tidak pilih program (tidak ada field program di User/Student creation)
- [x] Parent/Admin pilih program untuk anak → Task 2 (POST /api/program-enrollments)
- [x] Siswa hanya boleh 1 program aktif → Task 2 validasi conflict 409
- [x] Enrollment kelas hanya jika ada program aktif → Task 3
- [x] Program kelas harus cocok dengan program siswa → Task 3 validasi
- [x] Upgrade program → Task 2 endpoint upgrade (atomic transaction)
- [x] Admin lihat program aktif siswa → Task 5
- [x] Parent lihat program aktif anaknya → Task 7

### Type Consistency
- `ProgramEnrollment.status` → `ProgramEnrollmentStatus` enum (ACTIVE/COMPLETED/UPGRADED/DROPPED)
- `ProgramEnrollmentBadge` props → `{ program?: string | null }`
- `student.programEnrollments` → `ProgramEnrollmentInfo[]`
- API response dari GET `/api/students` → include `programEnrollments: ProgramEnrollmentInfo[]`

### Backward Compatibility
- `Enrollment.programEnrollmentId` dibuat optional (`String?`) → enrollment lama tidak break
- `Student.programEnrollments` adalah relasi baru, tidak mengubah field existing
