# Refactor Class Programs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `subject` string field on `Class` with a proper `Program` enum and `ClassProgram` join table so that combined programs like "AHE SEMPOA EFK" are represented as 3 separate program enrollments (AHE + SEMPOA + EFK), not a single string.

**Architecture:** Add a `Program` enum with individual program values, create a `ClassProgram` join table (Class ↔ Program many-to-many), migrate existing subject strings to individual programs, then remove the `subject` column. API and UI are updated to use `programs[]` array instead of `subject` string.

**Tech Stack:** Next.js 14, Prisma ORM, PostgreSQL, TypeScript, Tailwind CSS

---

## Domain Rules

| Subject string (old) | Programs (new) |
|---|---|
| SEMPOA | [SEMPOA] |
| EYL SEMPOA | [EYL, SEMPOA] |
| SEMPOA AHE | [SEMPOA, AHE] |
| AHE SEMPOA EFK | [AHE, SEMPOA, EFK] |
| SEMPOA EFE | [SEMPOA, EFE] |
| CALISTUNG | [CALISTUNG] |
| ENGLISH | [ENGLISH] |

---

## File Structure

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `Program` enum + `ClassProgram` model; remove `subject` from `Class` (two migrations) |
| `scripts/migrate-class-programs.ts` | One-time data migration script |
| `app/api/classes/route.ts` | Accept `programs: Program[]` in POST; include programs in GET |
| `app/api/classes/[id]/route.ts` | Accept `programs?: Program[]` in PUT; include programs in GET |
| `app/(dashboard)/admin/classes/page.tsx` | Multi-select programs toggle + info box |
| `app/(dashboard)/admin/timetable/page.tsx` | Replace SUBJECTS with PROGRAMS; update class card display |
| `prisma/seed.ts` | Replace `subject` with `programs` |
| `prisma/seed-dummy.ts` | Replace `subject` with `programs` |

---

### Task 1: Add Program enum + ClassProgram to schema (keep subject)

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Program enum and ClassProgram model to schema.prisma**

In `prisma/schema.prisma`, add after the `DayOfWeek` enum and before `model User`:

```prisma
enum Program {
  SEMPOA
  AHE
  EFK
  EYL
  EFE
  CALISTUNG
  ENGLISH
}

model ClassProgram {
  id        String  @id @default(cuid())
  classId   String
  program   Program
  class     Class   @relation(fields: [classId], references: [id], onDelete: Cascade)

  @@unique([classId, program])
}
```

Also add `programs ClassProgram[]` to the `Class` model (keep `subject` for now):

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

  programs    ClassProgram[]
  enrollments Enrollment[]
  schedules   Schedule[]
}
```

- [ ] **Step 2: Run migration**

```bash
cd c:\Users\weka\Learning\mellyna-education
npx prisma migrate dev --name add_class_programs
```

Expected: migration created and applied, `ClassProgram` table exists in DB.

- [ ] **Step 3: Verify with Prisma Studio (optional)**

```bash
npx prisma studio
```

Check that `ClassProgram` table is visible and empty.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add Program enum and ClassProgram join table"
```

---

### Task 2: Data migration — populate ClassProgram from existing subject strings

**Files:**
- Create: `scripts/migrate-class-programs.ts`

- [ ] **Step 1: Create migration script**

Create file `scripts/migrate-class-programs.ts`:

```typescript
import { PrismaClient, Program } from '@prisma/client'

const prisma = new PrismaClient()

const SUBJECT_TO_PROGRAMS: Record<string, Program[]> = {
  'SEMPOA':          ['SEMPOA'],
  'EYL SEMPOA':      ['EYL', 'SEMPOA'],
  'SEMPOA AHE':      ['SEMPOA', 'AHE'],
  'AHE SEMPOA EFK':  ['AHE', 'SEMPOA', 'EFK'],
  'SEMPOA EFE':      ['SEMPOA', 'EFE'],
  'CALISTUNG':       ['CALISTUNG'],
  'ENGLISH':         ['ENGLISH'],
}

async function main() {
  const classes = await prisma.class.findMany({ select: { id: true, subject: true } })
  let ok = 0, warn = 0

  for (const cls of classes) {
    const programs = SUBJECT_TO_PROGRAMS[(cls as any).subject] ?? []
    if (programs.length === 0) {
      console.warn(`WARN: Unknown subject "${(cls as any).subject}" for class ${cls.id} — skipping`)
      warn++
      continue
    }
    await prisma.classProgram.createMany({
      data: programs.map(program => ({ classId: cls.id, program })),
      skipDuplicates: true,
    })
    console.log(`✓ ${cls.id} (${(cls as any).subject}) → [${programs.join(', ')}]`)
    ok++
  }

  console.log(`\nDone: ${ok} migrated, ${warn} warnings`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Run migration script**

```bash
cd c:\Users\weka\Learning\mellyna-education
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/migrate-class-programs.ts
```

Expected output shows each class migrated, 0 warnings.

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-class-programs.ts
git commit -m "feat(db): add data migration script for class programs"
```

---

### Task 3: Remove subject column from Class

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Remove subject from Class model in schema.prisma**

Change the `Class` model — remove the `subject String` line:

```prisma
model Class {
  id          String     @id @default(cuid())
  name        String
  description String?
  dayOfWeek   DayOfWeek?
  timeSlot    String?
  tutorId     String
  tutor       User       @relation("TutorClasses", fields: [tutorId], references: [id])
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  programs    ClassProgram[]
  enrollments Enrollment[]
  schedules   Schedule[]
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name remove_class_subject
```

Expected: migration applied, `subject` column dropped from DB.

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): remove subject column from Class, programs via ClassProgram"
```

---

### Task 4: Update API routes

**Files:**
- Modify: `app/api/classes/route.ts`
- Modify: `app/api/classes/[id]/route.ts`

- [ ] **Step 1: Rewrite app/api/classes/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DayOfWeek, Program } from '@prisma/client'

const classInclude = {
  tutor: { select: { name: true, email: true } },
  _count: { select: { enrollments: true } },
  programs: { select: { program: true } },
  enrollments: {
    include: {
      student: { select: { id: true, name: true, grade: true } },
    },
  },
}

const createClassSchema = z.object({
  name: z.string().min(1),
  programs: z.array(z.nativeEnum(Program)).min(1),
  description: z.string().optional(),
  tutorId: z.string().min(1),
  dayOfWeek: z.nativeEnum(DayOfWeek).nullable().optional(),
  timeSlot: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id

  const where = role === 'TUTOR' ? { tutorId: userId } : {}

  const classes = await prisma.class.findMany({
    where,
    include: classInclude,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(classes)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createClassSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { programs, ...classData } = parsed.data
  const kelas = await prisma.class.create({
    data: {
      ...classData,
      programs: {
        create: programs.map(program => ({ program })),
      },
    },
    include: classInclude,
  })

  return NextResponse.json(kelas, { status: 201 })
}
```

- [ ] **Step 2: Rewrite app/api/classes/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { DayOfWeek, Program } from '@prisma/client'

const classInclude = {
  tutor: { select: { name: true, email: true } },
  programs: { select: { program: true } },
  enrollments: { include: { student: true } },
  schedules: { orderBy: { date: 'desc' as const }, take: 5 },
}

const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  programs: z.array(z.nativeEnum(Program)).min(1).optional(),
  description: z.string().optional(),
  tutorId: z.string().optional(),
  dayOfWeek: z.nativeEnum(DayOfWeek).nullable().optional(),
  timeSlot: z.string().nullable().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const kelas = await prisma.class.findUnique({ where: { id }, include: classInclude })

  if (!kelas) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  return NextResponse.json(kelas)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = updateClassSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { programs, ...classData } = parsed.data
  const updateData: any = { ...classData }

  if (programs) {
    updateData.programs = {
      deleteMany: {},
      create: programs.map(program => ({ program })),
    }
  }

  const kelas = await prisma.class.update({
    where: { id },
    data: updateData,
    include: classInclude,
  })

  return NextResponse.json(kelas)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  await prisma.class.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Build check**

```bash
cd c:\Users\weka\Learning\mellyna-education
npx tsc --noEmit
```

Expected: no TypeScript errors in API files.

- [ ] **Step 4: Commit**

```bash
git add app/api/classes/route.ts app/api/classes/[id]/route.ts
git commit -m "feat(api): replace subject string with programs array in classes API"
```

---

### Task 5: Update Classes page UI

**Files:**
- Modify: `app/(dashboard)/admin/classes/page.tsx`

Replace the entire file with the version below. Key changes:
- `SUBJECTS` → `PROGRAMS` constant with individual values
- `form.subject` → `form.programs: string[]`
- Subject dropdown → toggle button multi-select
- Info box at top of page
- Class cards show individual program badges

- [ ] **Step 1: Rewrite app/(dashboard)/admin/classes/page.tsx**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Users, Pencil, Info } from 'lucide-react'

const PROGRAMS = ['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH'] as const
type ProgramValue = typeof PROGRAMS[number]

const PROGRAM_COLORS: Record<ProgramValue, string> = {
  SEMPOA:    'bg-purple-100 text-purple-700 border border-purple-200',
  AHE:       'bg-amber-100 text-amber-700 border border-amber-200',
  EFK:       'bg-teal-100 text-teal-700 border border-teal-200',
  EYL:       'bg-pink-100 text-pink-700 border border-pink-200',
  EFE:       'bg-rose-100 text-rose-700 border border-rose-200',
  CALISTUNG: 'bg-green-100 text-green-700 border border-green-200',
  ENGLISH:   'bg-blue-100 text-blue-700 border border-blue-200',
}

interface ClassProgram { program: ProgramValue }

interface Class {
  id: string
  name: string
  programs: ClassProgram[]
  description: string | null
  tutor: { name: string; email: string }
  _count: { enrollments: number }
  enrollments?: Array<{ id: string; student: { id: string; name: string; grade: string | null } }>
}

function ProgramBadge({ program }: { program: ProgramValue }) {
  return (
    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${PROGRAM_COLORS[program] ?? 'bg-slate-100 text-slate-700'}`}>
      {program}
    </span>
  )
}

function ProgramToggle({
  selected,
  onChange,
}: {
  selected: ProgramValue[]
  onChange: (p: ProgramValue[]) => void
}) {
  const toggle = (p: ProgramValue) => {
    onChange(selected.includes(p) ? selected.filter(x => x !== p) : [...selected, p])
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {PROGRAMS.map(p => (
        <button
          key={p}
          type="button"
          onClick={() => toggle(p)}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
            selected.includes(p)
              ? `${PROGRAM_COLORS[p]} shadow-sm`
              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

const emptyForm = { name: '', programs: [] as ProgramValue[], description: '', tutorId: '' }

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tutors, setTutors] = useState<any[]>([])

  const [editClass, setEditClass] = useState<Class | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editSaving, setEditSaving] = useState(false)

  const [enrollClass, setEnrollClass] = useState<Class | null>(null)
  const [enrollStudentId, setEnrollStudentId] = useState('')
  const [enrollSaving, setEnrollSaving] = useState(false)
  const [allStudents, setAllStudents] = useState<{ id: string; name: string; grade: string | null }[]>([])

  const fetchClasses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/classes')
      setClasses(await res.json())
    } catch {
      setError('Gagal memuat data kelas.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTutors = useCallback(async () => {
    try {
      const res = await fetch('/api/tutors')
      setTutors(await res.json())
    } catch {}
  }, [])

  const fetchAllStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/students')
      setAllStudents(await res.json())
    } catch {}
  }, [])

  useEffect(() => {
    fetchClasses()
    fetchTutors()
    fetchAllStudents()
  }, [fetchClasses, fetchTutors, fetchAllStudents])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.programs.length === 0) { setError('Pilih minimal 1 program.'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Gagal menyimpan kelas.')
      await fetchClasses()
      setShowForm(false)
      setForm(emptyForm)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editClass) return
    if (editForm.programs.length === 0) { setError('Pilih minimal 1 program.'); return }
    setEditSaving(true)
    setError(null)
    try {
      const payload: any = { name: editForm.name, programs: editForm.programs, description: editForm.description }
      if (editForm.tutorId) payload.tutorId = editForm.tutorId
      const res = await fetch(`/api/classes/${editClass.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Gagal menyimpan perubahan.')
      await fetchClasses()
      setShowEditForm(false)
      setEditClass(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setEditSaving(false)
    }
  }

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!enrollClass || !enrollStudentId) return
    setEnrollSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: enrollStudentId, classId: enrollClass.id }),
      })
      if (!res.ok) throw new Error('Gagal mendaftarkan siswa.')
      const refetchRes = await fetch('/api/classes')
      const updatedClasses = await refetchRes.json()
      setClasses(updatedClasses)
      const refreshed = updatedClasses.find((c: Class) => c.id === enrollClass.id)
      if (refreshed) setEnrollClass(refreshed)
      setEnrollStudentId('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setEnrollSaving(false)
    }
  }

  const handleUnenroll = async (enrollmentId: string) => {
    if (!confirm('Keluarkan siswa dari kelas ini?')) return
    try {
      const delRes = await fetch(`/api/enrollments/${enrollmentId}`, { method: 'DELETE' })
      if (!delRes.ok) throw new Error()
      const refetchRes = await fetch('/api/classes')
      const updatedClasses = await refetchRes.json()
      setClasses(updatedClasses)
      if (enrollClass) {
        const refreshed = updatedClasses.find((c: Class) => c.id === enrollClass.id)
        if (refreshed) setEnrollClass(refreshed)
      }
    } catch {
      setError('Gagal mengeluarkan siswa.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">🏫 Data Kelas & Tutor</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola kelas bimbingan belajar dan penugasan tutor.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Buat Kelas Baru
        </button>
      </div>

      {/* Program info box */}
      <div className="flex gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
        <div>
          <span className="font-bold">Catatan Program: </span>
          Setiap kelas bisa terdiri dari beberapa program. Contoh: kelas dengan program <span className="font-bold">AHE + SEMPOA + EFK</span> berarti siswa di kelas ini mengikuti 3 program sekaligus — bukan satu mata pelajaran gabungan.
        </div>
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">⚠️ {error}</div>}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6 space-y-4">
          <div>
            <h2 className="font-bold text-slate-800">Tambah Kelas Baru</h2>
            <p className="text-xs text-slate-400 mt-0.5">Jadwal (hari & jam) diatur di halaman Timetable.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Kelas *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="mis. Sempoa Kelompok A"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tutor *</label>
                <select
                  required
                  value={form.tutorId}
                  onChange={(e) => setForm({ ...form, tutorId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="">Pilih Tutor</option>
                  {tutors.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Program * <span className="font-normal text-slate-400">(pilih semua yang relevan)</span></label>
              <ProgramToggle selected={form.programs} onChange={(p) => setForm({ ...form, programs: p })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Deskripsi</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Deskripsi singkat (opsional)"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan Kelas'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer">Batal</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.length === 0 ? (
            <div className="col-span-full rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
              <p className="text-3xl">📚</p>
              <p className="mt-2 font-medium text-sm">Belum ada kelas yang dibuat.</p>
            </div>
          ) : (
            classes.map((cls) => (
              <div key={cls.id} className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 flex flex-col gap-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">{cls.name}</h3>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {cls.programs.map(({ program }) => (
                        <ProgramBadge key={program} program={program} />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditClass(cls)
                      setEditForm({
                        name: cls.name,
                        programs: cls.programs.map(p => p.program),
                        description: cls.description || '',
                        tutorId: '',
                      })
                      setShowEditForm(true)
                    }}
                    className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-500">{cls.description || 'Tidak ada deskripsi.'}</p>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Users className="h-3.5 w-3.5" />
                    <span>{cls._count.enrollments} Siswa</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEnrollClass(cls)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
                    >
                      Kelola Siswa
                    </button>
                    <span className="text-xs text-slate-600 font-medium">Tutor: {cls.tutor.name}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Edit Class Modal */}
      {showEditForm && editClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => setShowEditForm(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl z-10">
            <h2 className="font-bold text-slate-800 mb-4">Edit Kelas: {editClass.name}</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Kelas *</label>
                  <input
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="mis. Sempoa Kelompok A"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Ganti Tutor (opsional)</label>
                  <select
                    value={editForm.tutorId}
                    onChange={(e) => setEditForm({ ...editForm, tutorId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="">Biarkan tutor saat ini ({editClass.tutor.name})</option>
                    {tutors.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Program * <span className="font-normal text-slate-400">(pilih semua yang relevan)</span></label>
                <ProgramToggle selected={editForm.programs} onChange={(p) => setEditForm({ ...editForm, programs: p })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Deskripsi</label>
                <input
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Deskripsi singkat (opsional)"
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={editSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
                  {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
                <button type="button" onClick={() => setShowEditForm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enrollment Management Modal */}
      {enrollClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => setEnrollClass(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl z-10 max-h-[80vh] overflow-y-auto">
            <h2 className="font-bold text-slate-800 mb-1">Kelola Siswa: {enrollClass.name}</h2>
            <div className="flex flex-wrap gap-1 mb-3">
              {enrollClass.programs.map(({ program }) => (
                <ProgramBadge key={program} program={program} />
              ))}
            </div>
            <p className="text-xs text-slate-500 mb-4">{enrollClass._count.enrollments} siswa terdaftar</p>

            <div className="space-y-2 mb-5">
              {(enrollClass.enrollments ?? []).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Belum ada siswa terdaftar.</p>
              ) : (
                (enrollClass.enrollments ?? []).map(({ id: enrollId, student }) => (
                  <div key={enrollId} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{student.name}</p>
                      <p className="text-xs text-slate-400">{student.grade || 'Kelas tidak diketahui'}</p>
                    </div>
                    <button
                      onClick={() => handleUnenroll(enrollId)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                    >
                      Keluarkan
                    </button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleEnrollSubmit} className="flex gap-3 border-t border-slate-100 pt-4">
              <select
                required
                value={enrollStudentId}
                onChange={(e) => setEnrollStudentId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
              >
                <option value="">Tambah siswa ke kelas ini...</option>
                {allStudents
                  .filter((s) => !(enrollClass.enrollments ?? []).some((e) => e.student.id === s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{s.grade ? ` (${s.grade})` : ''}</option>
                  ))}
              </select>
              <button type="submit" disabled={enrollSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50">
                {enrollSaving ? '...' : 'Daftarkan'}
              </button>
            </form>

            <button
              onClick={() => setEnrollClass(null)}
              className="mt-3 w-full text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors in classes page.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/admin/classes/page.tsx
git commit -m "feat(ui): replace subject with program multi-select on classes page"
```

---

### Task 6: Update Timetable page

**Files:**
- Modify: `app/(dashboard)/admin/timetable/page.tsx`

The timetable page uses `cls.subject` to look up SUBJECT_COLORS and display the subject badge. Replace with individual program badges from `cls.programs[]`.

- [ ] **Step 1: Update the SUBJECTS and SUBJECT_COLORS constants**

At the top of `app/(dashboard)/admin/timetable/page.tsx`, replace:

```typescript
const SUBJECTS = [
  'SEMPOA', 'EYL SEMPOA', 'SEMPOA AHE', 'AHE SEMPOA EFK', 'SEMPOA EFE', 'CALISTUNG', 'ENGLISH'
]

const SUBJECT_COLORS: Record<string, string> = {
  ENGLISH:   'bg-blue-100 text-blue-800 ...',
  // ... etc
}
```

With:

```typescript
const PROGRAMS = ['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH'] as const
type ProgramValue = typeof PROGRAMS[number]

const PROGRAM_COLORS: Record<string, string> = {
  SEMPOA:    'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
  AHE:       'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  EFK:       'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
  EYL:       'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300 border border-pink-200 dark:border-pink-800',
  EFE:       'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
  CALISTUNG: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800',
  ENGLISH:   'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
}
```

- [ ] **Step 2: Update ClassModel interface**

Replace `subject: string` with `programs: { program: ProgramValue }[]` in the `ClassModel` interface:

```typescript
interface ClassModel {
  id: string
  name: string
  programs: { program: ProgramValue }[]
  description: string | null
  dayOfWeek: DayOfWeek | null
  timeSlot: string | null
  tutorId: string
  tutor: { id: string; name: string }
  enrollments: { id: string; studentId: string; student: { id: string; name: string; grade: string | null } }[]
}
```

- [ ] **Step 3: Update classForm state**

Replace `subject: 'SEMPOA'` with `programs: ['SEMPOA'] as ProgramValue[]` in both `classForm` initial state declarations (lines ~80 and ~460 in the original file).

```typescript
const [classForm, setClassForm] = useState({
  name: '',
  programs: ['SEMPOA'] as ProgramValue[],
  tutorId: '',
  description: '',
  dayOfWeek: '' as DayOfWeek | '',
  timeSlot: '',
})
```

- [ ] **Step 4: Update class card in timetable grid**

Find the subject badge in the timetable cell (inside the grid map), replace:

```tsx
<span className={`inline-block px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wide uppercase ${SUBJECT_COLORS[cls.subject] ?? 'bg-slate-100 text-slate-800'}`}>
  {cls.subject}
</span>
```

With:

```tsx
<div className="flex flex-wrap gap-0.5">
  {cls.programs.map(({ program }) => (
    <span key={program} className={`inline-block px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wide uppercase ${PROGRAM_COLORS[program] ?? 'bg-slate-100 text-slate-800'}`}>
      {program}
    </span>
  ))}
</div>
```

- [ ] **Step 5: Update class form modal — subject dropdown → program toggle**

In the modal form for creating/editing classes, replace the subject `<select>` with the same `ProgramToggle` component approach. Add a local toggle component inside the file (copy from classes page), or import it if extracted to a shared component.

Replace:
```tsx
<div>
  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Mata Pelajaran *</label>
  <select
    required
    value={classForm.subject}
    onChange={(e) => setClassForm({ ...classForm, subject: e.target.value })}
    ...
  >
    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
  </select>
</div>
```

With:
```tsx
<div>
  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">Program * <span className="font-normal text-slate-400">(pilih semua yang relevan)</span></label>
  <div className="flex flex-wrap gap-1.5">
    {PROGRAMS.map(p => (
      <button
        key={p}
        type="button"
        onClick={() => {
          const current = classForm.programs
          const updated = current.includes(p) ? current.filter(x => x !== p) : [...current, p]
          setClassForm({ ...classForm, programs: updated })
        }}
        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
          classForm.programs.includes(p)
            ? `${PROGRAM_COLORS[p]} shadow-sm`
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
        }`}
      >
        {p}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 6: Update handleSaveClass to send programs instead of subject**

The `handleSaveClass` function sends `classForm` in the body. Since `classForm` now has `programs` instead of `subject`, the body sent to the API is already correct. Just verify the form doesn't still send `subject`.

- [ ] **Step 7: Update "select existing class" display in timetable modal**

In the `mode === 'select'` dropdown option label, replace `cls.subject` with a computed programs string:

```tsx
{classes.map(c => (
  <option key={c.id} value={c.id}>
    {c.name} ({c.programs.map(p => p.program).join(' + ')}) • {c.tutor.name} {c.dayOfWeek ? `(Aktif: ${DAYS.find(d => d.key === c.dayOfWeek)?.label || c.dayOfWeek} ${c.timeSlot})` : '(Belum Terjadwal)'}
  </option>
))}
```

Also update the detail panel below the select:
```tsx
<div className="font-bold text-slate-800 dark:text-slate-200">
  Program: <span className="text-indigo-650 dark:text-indigo-400">{classForm.programs.join(' + ')}</span>
</div>
```

- [ ] **Step 8: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add app/(dashboard)/admin/timetable/page.tsx
git commit -m "feat(ui): replace subject with program badges in timetable page"
```

---

### Task 7: Update seed files

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `prisma/seed-dummy.ts`

- [ ] **Step 1: Update prisma/seed.ts — remove subject, add programs**

Find the `classData` array (around line 171) and replace:

```typescript
const classData = [
  { name: 'Sempoa Kelas A',   programs: ['SEMPOA'] as const,         desc: 'Kelas pembelajaran sempoa tingkat dasar A' },
  { name: 'Sempoa Kelas B',   programs: ['SEMPOA'] as const,         desc: 'Kelas pembelajaran sempoa tingkat menengah B' },
  { name: 'Sempoa Kelas EYL', programs: ['EYL', 'SEMPOA'] as const,  desc: 'English for Young Learners Sempoa khusus TK-SD' },
  { name: 'Sempoa Kelas AHE', programs: ['SEMPOA', 'AHE'] as const,  desc: 'Metode AHE Anak Hebat Sempoa Terpadu' },
  { name: 'Sempoa Kelas EFK', programs: ['AHE', 'SEMPOA', 'EFK'] as const, desc: 'Kelas Calistung dan Sempoa EFK' },
  { name: 'Sempoa Kelas EFE', programs: ['SEMPOA', 'EFE'] as const,  desc: 'Sesi latihan Sempoa EFE intensif' },
]
```

Update the class creation:
```typescript
const c = await prisma.class.create({
  data: {
    id: `real-class-${i + 1}`,
    name: classData[i].name,
    description: classData[i].desc,
    tutorId: tutor.id,
    programs: {
      create: classData[i].programs.map(program => ({ program })),
    },
  }
})
```

Remove the enrollment filter that used `subject` (line ~195):
```typescript
// Remove: if (student.grade?.includes(classData[i].subject))
// Replace with simple enrollment of first few students, or remove auto-enrollment:
for (const student of students.slice(0, 3)) {
  await prisma.enrollment.upsert({
    where: { studentId_classId: { studentId: student.id, classId: c.id } },
    create: { studentId: student.id, classId: c.id },
    update: {},
  })
}
```

- [ ] **Step 2: Update prisma/seed-dummy.ts — grep and fix subject references**

```bash
cd c:\Users\weka\Learning\mellyna-education
grep -n "subject" prisma/seed-dummy.ts
```

Apply same pattern: replace `subject:` with `programs: { create: [...] }`.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts prisma/seed-dummy.ts
git commit -m "feat(seed): update class seeds to use programs array"
```

---

## Self-Review

**Spec coverage:**
- ✅ "AHE SEMPOA EFK" = 3 programs: handled via ClassProgram join table
- ✅ Data migration: Task 2 migrates existing DB data
- ✅ Info box disclaimer: Task 5 classes page
- ✅ API updated: Task 4
- ✅ Timetable UI updated: Task 6
- ✅ Seeds updated: Task 7

**Gaps / Notes:**
- The `scripts/migrate-class-programs.ts` needs `"subject"` field accessible even after Task 3 drops the column — **run Task 2 BEFORE Task 3**.
- If other pages/components query `cls.subject` (e.g., parent dashboard, tutor schedule view), grep for `subject` after completing tasks to catch any remaining references.
- `seed-dummy.ts` details in Task 7 Step 2 require manual review of the full file since it wasn't fully read during planning.
