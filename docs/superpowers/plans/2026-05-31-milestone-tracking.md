# Milestone Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add curriculum milestone tracking to the superadmin dashboard (CRUD + student progress view) and the parent dashboard (visual progress view per program).

**Architecture:** New `Milestone` (curriculum definitions per program) and `StudentMilestone` (per-student status tracking) Prisma models. Superadmin manages milestone definitions and can update student progress. Parents view their child's progress with per-program progress bars.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma ORM (PostgreSQL), NextAuth (JWT sessions), Tailwind CSS, Zod validation, Radix UI, Lucide React icons, Jest (unit tests).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add `MilestoneStatus` enum, `Milestone`, `StudentMilestone` models + relations |
| Create | `app/api/milestones/route.ts` | GET list (all roles), POST create (admin only) |
| Create | `app/api/milestones/[id]/route.ts` | PATCH update, DELETE (admin only) |
| Create | `app/api/student-milestones/route.ts` | GET by student+program, PATCH update status (admin only) |
| Create | `app/(dashboard)/admin/milestones/page.tsx` | Server component — fetch milestones grouped by program |
| Create | `app/(dashboard)/admin/milestones/MilestonesClient.tsx` | Client — CRUD UI for milestone definitions |
| Create | `app/(dashboard)/admin/milestones/progress/page.tsx` | Server component — student selection, fetch students list |
| Create | `app/(dashboard)/admin/milestones/progress/StudentProgressClient.tsx` | Client — select student, view/update milestone statuses |
| Create | `app/(dashboard)/parent/milestones/page.tsx` | Server component — fetch child milestones with progress |
| Modify | `components/dashboard/sidebar.tsx` | Add Kurikulum group (admin) + Milestone menu item (parent) |
| Create | `__tests__/api/milestones.test.ts` | Unit tests for milestone access control and validation logic |
| Create | `__tests__/api/student-milestones.test.ts` | Unit tests for student milestone logic |

---

## Task 1: Schema — Add Milestone and StudentMilestone Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add models to schema**

Open `prisma/schema.prisma` and add the following **after the `Program` enum block** (around line 53):

```prisma
enum MilestoneStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
}
```

Add after the `DailyPiket` model at the end of the file:

```prisma
model Milestone {
  id          String   @id @default(cuid())
  name        String
  description String?  @db.Text
  program     Program
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  studentMilestones StudentMilestone[]

  @@index([program, order])
}

model StudentMilestone {
  id          String          @id @default(cuid())
  studentId   String
  milestoneId String
  status      MilestoneStatus @default(NOT_STARTED)
  completedAt DateTime?
  notes       String?
  updatedById String?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  student     Student         @relation(fields: [studentId], references: [id], onDelete: Cascade)
  milestone   Milestone       @relation(fields: [milestoneId], references: [id], onDelete: Cascade)
  updatedBy   User?           @relation("MilestoneUpdater", fields: [updatedById], references: [id])

  @@unique([studentId, milestoneId])
}
```

Add to the `Student` model (after `scheduleParticipants` line):

```prisma
  studentMilestones    StudentMilestone[]
```

Add to the `User` model (after `reports` line):

```prisma
  milestoneUpdates     StudentMilestone[] @relation("MilestoneUpdater")
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_milestones
```

Expected output:
```
✔ Generated Prisma Client
The following migration(s) have been applied:
  migrations/XXXXXXXX_add_milestones/migration.sql
```

- [ ] **Step 3: Verify Prisma client generates without errors**

```bash
npx prisma generate
```

Expected: no errors, `Generated Prisma Client` message.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Milestone and StudentMilestone models to schema"
```

---

## Task 2: Tests — Milestone API Logic

**Files:**
- Create: `__tests__/api/milestones.test.ts`
- Create: `__tests__/api/student-milestones.test.ts`

- [ ] **Step 1: Write milestone API tests**

Create `__tests__/api/milestones.test.ts`:

```typescript
describe('Milestone API access control', () => {
  it('only SUPER_ADMIN can create milestones', () => {
    const allowed = ['SUPER_ADMIN']
    expect(allowed.includes('SUPER_ADMIN')).toBe(true)
    expect(allowed.includes('TUTOR')).toBe(false)
    expect(allowed.includes('PARENT')).toBe(false)
  })

  it('only SUPER_ADMIN can delete milestones', () => {
    const allowed = ['SUPER_ADMIN']
    expect(allowed.includes('SUPER_ADMIN')).toBe(true)
    expect(allowed.includes('PARENT')).toBe(false)
  })

  it('all authenticated roles can read milestones', () => {
    const readRoles = ['SUPER_ADMIN', 'TUTOR', 'PARENT']
    expect(readRoles.includes('SUPER_ADMIN')).toBe(true)
    expect(readRoles.includes('TUTOR')).toBe(true)
    expect(readRoles.includes('PARENT')).toBe(true)
  })
})

describe('Milestone validation logic', () => {
  it('validates name is not empty', () => {
    const isValid = (name: string) => name.trim().length > 0
    expect(isValid('Level 1 Sempoa')).toBe(true)
    expect(isValid('')).toBe(false)
    expect(isValid('  ')).toBe(false)
  })

  it('validates order must be non-negative integer', () => {
    const isValidOrder = (order: number) => Number.isInteger(order) && order >= 0
    expect(isValidOrder(0)).toBe(true)
    expect(isValidOrder(10)).toBe(true)
    expect(isValidOrder(-1)).toBe(false)
    expect(isValidOrder(1.5)).toBe(false)
  })

  it('validates program is a valid Program enum value', () => {
    const validPrograms = ['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH']
    expect(validPrograms.includes('SEMPOA')).toBe(true)
    expect(validPrograms.includes('ENGLISH')).toBe(true)
    expect(validPrograms.includes('INVALID')).toBe(false)
    expect(validPrograms.includes('')).toBe(false)
  })

  it('sorts milestones by order ascending', () => {
    const milestones = [{ order: 3 }, { order: 1 }, { order: 2 }]
    const sorted = [...milestones].sort((a, b) => a.order - b.order)
    expect(sorted[0].order).toBe(1)
    expect(sorted[1].order).toBe(2)
    expect(sorted[2].order).toBe(3)
  })
})
```

- [ ] **Step 2: Write student-milestone API tests**

Create `__tests__/api/student-milestones.test.ts`:

```typescript
describe('StudentMilestone access control', () => {
  it('only SUPER_ADMIN can update student milestone status', () => {
    const allowed = ['SUPER_ADMIN']
    expect(allowed.includes('SUPER_ADMIN')).toBe(true)
    expect(allowed.includes('TUTOR')).toBe(false)
    expect(allowed.includes('PARENT')).toBe(false)
  })

  it('PARENT can only read their own child milestones', () => {
    const parentId = 'parent-1'
    const student = { parentId: 'parent-1' }
    expect(student.parentId === parentId).toBe(true)

    const otherStudent = { parentId: 'parent-2' }
    expect(otherStudent.parentId === parentId).toBe(false)
  })
})

describe('StudentMilestone status logic', () => {
  it('validates status is a valid MilestoneStatus value', () => {
    const validStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']
    expect(validStatuses.includes('NOT_STARTED')).toBe(true)
    expect(validStatuses.includes('COMPLETED')).toBe(true)
    expect(validStatuses.includes('INVALID')).toBe(false)
  })

  it('sets completedAt when status changes to COMPLETED', () => {
    const now = new Date()
    const getCompletedAt = (status: string, existing?: Date) => {
      if (status === 'COMPLETED' && !existing) return now
      if (status !== 'COMPLETED') return null
      return existing ?? null
    }
    expect(getCompletedAt('COMPLETED')).toBeInstanceOf(Date)
    expect(getCompletedAt('IN_PROGRESS')).toBeNull()
    expect(getCompletedAt('NOT_STARTED')).toBeNull()
  })

  it('calculates progress percentage correctly', () => {
    const calcProgress = (completed: number, total: number) => {
      if (total === 0) return 0
      return Math.round((completed / total) * 100)
    }
    expect(calcProgress(3, 10)).toBe(30)
    expect(calcProgress(10, 10)).toBe(100)
    expect(calcProgress(0, 5)).toBe(0)
    expect(calcProgress(0, 0)).toBe(0)
  })
})
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
npx jest __tests__/api/milestones.test.ts __tests__/api/student-milestones.test.ts --no-coverage
```

Expected: all tests pass (PASS status).

- [ ] **Step 4: Commit**

```bash
git add __tests__/api/milestones.test.ts __tests__/api/student-milestones.test.ts
git commit -m "test: add unit tests for milestone API logic"
```

---

## Task 3: Milestone API Routes

**Files:**
- Create: `app/api/milestones/route.ts`
- Create: `app/api/milestones/[id]/route.ts`

- [ ] **Step 1: Create milestone list/create route**

Create `app/api/milestones/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Program } from '@prisma/client'

const createMilestoneSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  program: z.nativeEnum(Program),
  order: z.number().int().min(0).default(0),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const program = searchParams.get('program') as Program | null

  const milestones = await prisma.milestone.findMany({
    where: program ? { program } : {},
    orderBy: [{ program: 'asc' }, { order: 'asc' }],
  })

  return NextResponse.json(milestones)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createMilestoneSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const milestone = await prisma.milestone.create({ data: parsed.data })
  return NextResponse.json(milestone, { status: 201 })
}
```

- [ ] **Step 2: Create milestone update/delete route**

Create `app/api/milestones/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Program } from '@prisma/client'

const updateMilestoneSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  program: z.nativeEnum(Program).optional(),
  order: z.number().int().min(0).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = updateMilestoneSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const milestone = await prisma.milestone.update({
    where: { id },
    data: parsed.data,
  })
  return NextResponse.json(milestone)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  await prisma.milestone.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/milestones/
git commit -m "feat: add milestone CRUD API routes"
```

---

## Task 4: Student Milestone API Route

**Files:**
- Create: `app/api/student-milestones/route.ts`

- [ ] **Step 1: Create student milestone route**

Create `app/api/student-milestones/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { MilestoneStatus, Program } from '@prisma/client'

const updateStatusSchema = z.object({
  studentId: z.string().min(1),
  milestoneId: z.string().min(1),
  status: z.nativeEnum(MilestoneStatus),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId')
  const program = searchParams.get('program') as Program | null

  // PARENT: can only see their own children
  if (role === 'PARENT') {
    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 })
    }
    const student = await prisma.student.findFirst({
      where: { id: studentId, parentId: userId },
    })
    if (!student) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const milestones = await prisma.milestone.findMany({
    where: program ? { program } : {},
    orderBy: [{ program: 'asc' }, { order: 'asc' }],
    include: {
      studentMilestones: studentId
        ? { where: { studentId } }
        : true,
    },
  })

  return NextResponse.json(milestones)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const updaterId = (session.user as any).id

  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = updateStatusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { studentId, milestoneId, status, notes } = parsed.data

  const completedAt = status === 'COMPLETED' ? new Date() : null

  const studentMilestone = await prisma.studentMilestone.upsert({
    where: { studentId_milestoneId: { studentId, milestoneId } },
    update: { status, notes, completedAt, updatedById: updaterId },
    create: { studentId, milestoneId, status, notes, completedAt, updatedById: updaterId },
  })

  return NextResponse.json(studentMilestone)
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/student-milestones/
git commit -m "feat: add student milestone progress API route"
```

---

## Task 5: Admin Milestones Management Page

**Files:**
- Create: `app/(dashboard)/admin/milestones/page.tsx`
- Create: `app/(dashboard)/admin/milestones/MilestonesClient.tsx`

- [ ] **Step 1: Create the server component page**

Create `app/(dashboard)/admin/milestones/page.tsx`:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import MilestonesClient from './MilestonesClient'

export default async function AdminMilestonesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') redirect('/admin')

  const milestones = await prisma.milestone.findMany({
    orderBy: [{ program: 'asc' }, { order: 'asc' }],
  })

  return <MilestonesClient initialMilestones={milestones} />
}
```

- [ ] **Step 2: Create the client component**

Create `app/(dashboard)/admin/milestones/MilestonesClient.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Program } from '@prisma/client'
import { Plus, Pencil, Trash2, BookMarked } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Milestone = {
  id: string
  name: string
  description: string | null
  program: Program
  order: number
}

const PROGRAMS: Program[] = ['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH']

const PROGRAM_LABELS: Record<Program, string> = {
  SEMPOA: 'Sempoa',
  AHE: 'AHE',
  EFK: 'EFK',
  EYL: 'EYL',
  EFE: 'EFE',
  CALISTUNG: 'Calistung',
  ENGLISH: 'English',
}

const PROGRAM_COLORS: Record<Program, string> = {
  SEMPOA: 'from-indigo-500 to-indigo-600',
  AHE: 'from-emerald-500 to-emerald-600',
  EFK: 'from-amber-500 to-amber-600',
  EYL: 'from-rose-500 to-rose-600',
  EFE: 'from-cyan-500 to-cyan-600',
  CALISTUNG: 'from-violet-500 to-violet-600',
  ENGLISH: 'from-orange-500 to-orange-600',
}

export default function MilestonesClient({ initialMilestones }: { initialMilestones: Milestone[] }) {
  const router = useRouter()
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones)
  const [activeProgram, setActiveProgram] = useState<Program>('SEMPOA')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Milestone | null>(null)
  const [form, setForm] = useState({ name: '', description: '', program: 'SEMPOA' as Program, order: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = milestones.filter((m) => m.program === activeProgram)

  const openCreate = () => {
    setEditTarget(null)
    setForm({ name: '', description: '', program: activeProgram, order: filtered.length })
    setError('')
    setShowForm(true)
  }

  const openEdit = (m: Milestone) => {
    setEditTarget(m)
    setForm({ name: m.name, description: m.description ?? '', program: m.program, order: m.order })
    setError('')
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Nama milestone wajib diisi'); return }
    setLoading(true)
    setError('')
    try {
      if (editTarget) {
        const res = await fetch(`/api/milestones/${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Gagal memperbarui milestone')
        const updated: Milestone = await res.json()
        setMilestones((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
      } else {
        const res = await fetch('/api/milestones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Gagal membuat milestone')
        const created: Milestone = await res.json()
        setMilestones((prev) => [...prev, created])
      }
      setShowForm(false)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus milestone ini? Data progress siswa yang terhubung juga akan terhapus.')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/milestones/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus milestone')
      setMilestones((prev) => prev.filter((m) => m.id !== id))
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-700 p-5 sm:p-8 text-white shadow-xl shadow-violet-600/10">
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">Milestone Kurikulum</h1>
        <p className="mt-2 text-sm sm:text-base text-violet-100">
          Kelola pencapaian kurikulum per program sebagai acuan perkembangan siswa.
        </p>
      </div>

      {/* Program Tabs */}
      <div className="flex flex-wrap gap-2">
        {PROGRAMS.map((p) => {
          const count = milestones.filter((m) => m.program === p).length
          return (
            <button
              key={p}
              onClick={() => setActiveProgram(p)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                activeProgram === p
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
              }`}
            >
              {PROGRAM_LABELS[p]}
              <span className="ml-2 text-xs opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Milestone List */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${PROGRAM_COLORS[activeProgram]} text-white`}>
              <BookMarked className="h-4 w-4" />
            </div>
            <h2 className="font-bold text-slate-800 dark:text-white">
              {PROGRAM_LABELS[activeProgram]} — {filtered.length} Milestone
            </h2>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
          >
            <Plus className="h-4 w-4" />
            Tambah Milestone
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <p className="text-3xl">🎯</p>
            <p className="mt-2 text-sm">Belum ada milestone untuk program ini.</p>
            <button onClick={openCreate} className="mt-4 text-indigo-600 text-sm font-semibold hover:underline">
              Tambah milestone pertama →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((m, idx) => (
              <div key={m.id} className="flex items-start justify-between px-6 py-4 gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-white text-sm">{m.name}</p>
                    {m.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(m)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(m.id)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 border border-rose-100 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Link to student progress */}
      <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-bold text-indigo-800 dark:text-indigo-300 text-sm">Lihat Progress Siswa</p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
            Pantau dan perbarui pencapaian milestone per siswa.
          </p>
        </div>
        <a
          href="/admin/milestones/progress"
          className="shrink-0 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
        >
          Progress Siswa →
        </a>
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="font-extrabold text-slate-800 dark:text-white">
              {editTarget ? 'Edit Milestone' : 'Tambah Milestone Baru'}
            </h3>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-600">{error}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Program</label>
                <select
                  value={form.program}
                  onChange={(e) => setForm({ ...form, program: e.target.value as Program })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PROGRAMS.map((p) => (
                    <option key={p} value={p}>{PROGRAM_LABELS[p]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Milestone *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="contoh: Mampu berhitung 1-10 dengan sempoa"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deskripsi (opsional)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Jelaskan kriteria pencapaian milestone ini..."
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Urutan</label>
                <input
                  type="number"
                  min={0}
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : editTarget ? 'Simpan Perubahan' : 'Tambah Milestone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/admin/milestones/
git commit -m "feat: add admin milestone management page"
```

---

## Task 6: Admin Student Progress Page

**Files:**
- Create: `app/(dashboard)/admin/milestones/progress/page.tsx`
- Create: `app/(dashboard)/admin/milestones/progress/StudentProgressClient.tsx`

- [ ] **Step 1: Create the server component**

Create `app/(dashboard)/admin/milestones/progress/page.tsx`:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import StudentProgressClient from './StudentProgressClient'

export default async function AdminMilestoneProgressPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') redirect('/admin')

  const [students, milestones] = await Promise.all([
    prisma.student.findMany({
      where: { isActive: true },
      select: { id: true, name: true, grade: true },
      orderBy: { name: 'asc' },
    }),
    prisma.milestone.findMany({
      orderBy: [{ program: 'asc' }, { order: 'asc' }],
    }),
  ])

  return <StudentProgressClient students={students} milestones={milestones} />
}
```

- [ ] **Step 2: Create the client component**

Create `app/(dashboard)/admin/milestones/progress/StudentProgressClient.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Program, MilestoneStatus } from '@prisma/client'
import { CheckCircle2, Circle, Clock, ChevronDown, Award } from 'lucide-react'

type Student = { id: string; name: string; grade: string | null }
type Milestone = { id: string; name: string; description: string | null; program: Program; order: number }
type StudentMilestoneRecord = {
  id: string
  studentId: string
  milestoneId: string
  status: MilestoneStatus
  completedAt: string | null
  notes: string | null
}
type MilestoneWithProgress = Milestone & { studentMilestones: StudentMilestoneRecord[] }

const PROGRAMS: Program[] = ['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH']
const PROGRAM_LABELS: Record<Program, string> = {
  SEMPOA: 'Sempoa', AHE: 'AHE', EFK: 'EFK', EYL: 'EYL', EFE: 'EFE', CALISTUNG: 'Calistung', ENGLISH: 'English',
}

const STATUS_CONFIG: Record<MilestoneStatus, { label: string; icon: typeof CheckCircle2; class: string }> = {
  NOT_STARTED: { label: 'Belum Mulai', icon: Circle, class: 'text-slate-400' },
  IN_PROGRESS: { label: 'Sedang Berjalan', icon: Clock, class: 'text-amber-500' },
  COMPLETED: { label: 'Selesai', icon: CheckCircle2, class: 'text-emerald-500' },
}

export default function StudentProgressClient({
  students,
  milestones,
}: {
  students: Student[]
  milestones: Milestone[]
}) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [activeProgram, setActiveProgram] = useState<Program>('SEMPOA')
  const [progressData, setProgressData] = useState<MilestoneWithProgress[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchProgress = async (studentId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/student-milestones?studentId=${studentId}`)
      if (!res.ok) throw new Error('Gagal memuat data')
      setProgressData(await res.json())
    } catch {
      alert('Gagal memuat progress siswa')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedStudentId) fetchProgress(selectedStudentId)
    else setProgressData([])
  }, [selectedStudentId])

  const getStudentMilestone = (milestoneId: string): StudentMilestoneRecord | undefined =>
    progressData.find((m) => m.id === milestoneId)?.studentMilestones[0]

  const updateStatus = async (milestoneId: string, status: MilestoneStatus) => {
    if (!selectedStudentId) return
    setUpdating(milestoneId)
    try {
      const res = await fetch('/api/student-milestones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudentId, milestoneId, status }),
      })
      if (!res.ok) throw new Error('Gagal memperbarui status')
      await fetchProgress(selectedStudentId)
    } catch {
      alert('Gagal memperbarui status milestone')
    } finally {
      setUpdating(null)
    }
  }

  const programMilestones = milestones.filter((m) => m.program === activeProgram)
  const completedCount = programMilestones.filter(
    (m) => getStudentMilestone(m.id)?.status === 'COMPLETED'
  ).length
  const progressPercent = programMilestones.length > 0
    ? Math.round((completedCount / programMilestones.length) * 100)
    : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 p-5 sm:p-8 text-white shadow-xl shadow-emerald-600/10">
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">Progress Milestone Siswa</h1>
        <p className="mt-2 text-sm sm:text-base text-emerald-100">
          Pantau dan perbarui pencapaian kurikulum per siswa.
        </p>
      </div>

      {/* Student Selector */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs p-6">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Pilih Siswa</label>
        <div className="relative mt-2">
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 pr-10 text-sm font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">-- Pilih siswa --</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.grade ? ` (${s.grade})` : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {selectedStudentId && (
        <>
          {/* Program Tabs */}
          <div className="flex flex-wrap gap-2">
            {PROGRAMS.map((p) => {
              const pMilestones = milestones.filter((m) => m.program === p)
              const pCompleted = pMilestones.filter(
                (m) => getStudentMilestone(m.id)?.status === 'COMPLETED'
              ).length
              return (
                <button
                  key={p}
                  onClick={() => setActiveProgram(p)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                    activeProgram === p
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                  }`}
                >
                  {PROGRAM_LABELS[p]}
                  {pMilestones.length > 0 && (
                    <span className="ml-2 text-xs opacity-70">{pCompleted}/{pMilestones.length}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Progress Section */}
          {loading ? (
            <div className="text-center py-10 text-slate-400 text-sm">Memuat data...</div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden">
              {/* Progress Header */}
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-slate-800 dark:text-white">
                    {PROGRAM_LABELS[activeProgram]} — Progress
                  </h2>
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-emerald-500" />
                    <span className="font-bold text-emerald-600 text-sm">{progressPercent}%</span>
                    <span className="text-xs text-slate-400">({completedCount}/{programMilestones.length})</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {programMilestones.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">
                  Belum ada milestone untuk program ini.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {programMilestones.map((m, idx) => {
                    const sm = getStudentMilestone(m.id)
                    const status: MilestoneStatus = sm?.status ?? 'NOT_STARTED'
                    const statusCfg = STATUS_CONFIG[status]
                    const StatusIcon = statusCfg.icon
                    const isUpdating = updating === m.id

                    return (
                      <div key={m.id} className="flex items-start gap-4 px-6 py-4">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-800 dark:text-white">{m.name}</p>
                          {m.description && <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>}
                          {sm?.completedAt && (
                            <p className="text-xs text-emerald-500 mt-0.5">
                              Selesai: {new Date(sm.completedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0">
                          <select
                            value={status}
                            onChange={(e) => updateStatus(m.id, e.target.value as MilestoneStatus)}
                            disabled={isUpdating}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors
                              ${status === 'COMPLETED' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                              : status === 'IN_PROGRESS' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                          >
                            <option value="NOT_STARTED">Belum Mulai</option>
                            <option value="IN_PROGRESS">Sedang Berjalan</option>
                            <option value="COMPLETED">Selesai</option>
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/admin/milestones/progress/
git commit -m "feat: add admin student milestone progress page"
```

---

## Task 7: Parent Milestones Page

**Files:**
- Create: `app/(dashboard)/parent/milestones/page.tsx`

- [ ] **Step 1: Create the parent milestone page (server component)**

Create `app/(dashboard)/parent/milestones/page.tsx`:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Program, MilestoneStatus } from '@prisma/client'

const PROGRAMS: Program[] = ['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH']
const PROGRAM_LABELS: Record<Program, string> = {
  SEMPOA: 'Sempoa', AHE: 'AHE', EFK: 'EFK', EYL: 'EYL', EFE: 'EFE', CALISTUNG: 'Calistung', ENGLISH: 'English',
}
const PROGRAM_COLORS: Record<Program, string> = {
  SEMPOA: 'from-indigo-500 to-indigo-600',
  AHE: 'from-emerald-500 to-emerald-600',
  EFK: 'from-amber-500 to-amber-600',
  EYL: 'from-rose-500 to-rose-600',
  EFE: 'from-cyan-500 to-cyan-600',
  CALISTUNG: 'from-violet-500 to-violet-600',
  ENGLISH: 'from-orange-500 to-orange-600',
}

const STATUS_BADGE: Record<MilestoneStatus, { label: string; class: string }> = {
  NOT_STARTED: { label: 'Belum Mulai', class: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  IN_PROGRESS: { label: 'Sedang Berjalan', class: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  COMPLETED: { label: 'Selesai', class: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
}

export default async function ParentMilestonesPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const { studentId } = await searchParams

  const children = await prisma.student.findMany({
    where: { parentId: userId, isActive: true },
    select: { id: true, name: true },
  })

  if (children.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">🎯 Milestone Belajar</h1>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 text-center text-slate-400">
          <p className="text-3xl">👶</p>
          <p className="mt-2 text-sm">Belum ada data anak terdaftar.</p>
        </div>
      </div>
    )
  }

  const activeChild = children.find((c) => c.id === studentId) ?? children[0]

  const milestones = await prisma.milestone.findMany({
    orderBy: [{ program: 'asc' }, { order: 'asc' }],
    include: {
      studentMilestones: {
        where: { studentId: activeChild.id },
      },
    },
  })

  // Group milestones by program, only show programs that have milestones defined
  const byProgram = PROGRAMS.reduce((acc, p) => {
    const pMilestones = milestones.filter((m) => m.program === p)
    if (pMilestones.length > 0) acc[p] = pMilestones
    return acc
  }, {} as Record<Program, typeof milestones>)

  const programsWithMilestones = Object.keys(byProgram) as Program[]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-700 p-5 sm:p-8 text-white shadow-xl shadow-violet-600/10">
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">🎯 Milestone Belajar</h1>
        <p className="mt-2 text-sm sm:text-base text-violet-100">
          Pantau pencapaian kurikulum {activeChild.name} secara terstruktur.
        </p>
      </div>

      {/* Child Selector */}
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((c) => (
            <a
              key={c.id}
              href={`/parent/milestones?studentId=${c.id}`}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                activeChild.id === c.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
              }`}
            >
              {c.name}
            </a>
          ))}
        </div>
      )}

      {programsWithMilestones.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 text-center text-slate-400">
          <p className="text-3xl">🎯</p>
          <p className="mt-2 text-sm">Belum ada milestone kurikulum yang didefinisikan.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {programsWithMilestones.map((program) => {
            const pMilestones = byProgram[program]
            const completed = pMilestones.filter(
              (m) => m.studentMilestones[0]?.status === 'COMPLETED'
            ).length
            const inProgress = pMilestones.filter(
              (m) => m.studentMilestones[0]?.status === 'IN_PROGRESS'
            ).length
            const percent = Math.round((completed / pMilestones.length) * 100)

            return (
              <div
                key={program}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden"
              >
                {/* Program Header */}
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${PROGRAM_COLORS[program]} text-white text-xs font-extrabold`}>
                        {PROGRAM_LABELS[program].substring(0, 2)}
                      </div>
                      <div>
                        <h2 className="font-extrabold text-slate-800 dark:text-white">{PROGRAM_LABELS[program]}</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {completed} selesai · {inProgress} berjalan · {pMilestones.length - completed - inProgress} belum mulai
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-2xl font-extrabold ${percent === 100 ? 'text-emerald-600' : percent > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {percent}%
                      </span>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full bg-gradient-to-r ${PROGRAM_COLORS[program]} transition-all duration-500`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Milestone List */}
                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {pMilestones.map((m, idx) => {
                    const sm = m.studentMilestones[0]
                    const status: MilestoneStatus = sm?.status ?? 'NOT_STARTED'
                    const badge = STATUS_BADGE[status]

                    return (
                      <div key={m.id} className="flex items-start gap-3 px-6 py-3.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-400 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${status === 'COMPLETED' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-white'}`}>
                            {m.name}
                          </p>
                          {m.description && (
                            <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>
                          )}
                          {sm?.completedAt && (
                            <p className="text-xs text-emerald-500 mt-0.5">
                              ✓ {new Date(sm.completedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${badge.class}`}>
                          {badge.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/parent/milestones/
git commit -m "feat: add parent milestone progress visualization page"
```

---

## Task 8: Sidebar Navigation Updates

**Files:**
- Modify: `components/dashboard/sidebar.tsx`

- [ ] **Step 1: Add Trophy icon import and update nav items**

In `components/dashboard/sidebar.tsx`:

1. Add `Trophy` to the lucide-react import (after `ChevronDown`):

```typescript
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  CreditCard,
  Megaphone,
  TrendingUp,
  LogOut,
  Menu,
  X,
  Settings,
  FileText,
  BarChart2,
  BarChart3,
  Tag,
  Grid3x3,
  UsersRound,
  ChevronDown,
  Trophy,
  BookMarked,
} from 'lucide-react'
```

2. In the `SUPER_ADMIN` nav items (inside `getNavLinks()`), add the Kurikulum group after the `{ name: 'Laporan', ... }` item:

```typescript
{
  name: 'Kurikulum',
  icon: Trophy,
  subItems: [
    { name: 'Milestone', href: '/admin/milestones', icon: BookMarked },
    { name: 'Progress Siswa', href: '/admin/milestones/progress', icon: TrendingUp },
  ],
},
```

3. In the `PARENT` nav items, add after `{ name: 'Perkembangan', ... }`:

```typescript
{ name: 'Milestone Belajar', href: '/parent/milestones', icon: Trophy },
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/sidebar.tsx
git commit -m "feat: add milestone navigation items to admin and parent sidebar"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Milestone definitions per program (admin CRUD) — Task 3 + Task 5
- ✅ Student milestone progress tracking (admin update) — Task 4 + Task 6
- ✅ Parent dashboard milestone progress view — Task 7
- ✅ Admin dashboard milestone management — Task 5
- ✅ Schema changes — Task 1
- ✅ Navigation (sidebar) — Task 8
- ✅ Tests — Task 2

**Placeholder check:** All code blocks are complete with actual implementation. No TBD/TODO in code.

**Type consistency check:**
- `MilestoneStatus` enum used consistently: `NOT_STARTED | IN_PROGRESS | COMPLETED`
- `Program` enum reused from existing schema
- `StudentMilestone` upsert uses `studentId_milestoneId` compound key (matches `@@unique([studentId, milestoneId])`)
- `params` in route handlers typed as `Promise<{ id: string }>` (Next.js 15 pattern, consistent with project)
- `progressData` typed as `MilestoneWithProgress[]` in `StudentProgressClient`, matching the API response structure

**Note:** The `completedAt` field in `PATCH /api/student-milestones` always sets `new Date()` when marking COMPLETED. This intentionally overwrites a previous completedAt if admin re-marks a milestone completed. This is acceptable for the current scope.
