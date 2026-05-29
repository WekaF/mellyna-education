# Schedule Per-Session Participants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign schedule creation flow so admin selects specific students per session via a multi-select (Select2-style) dropdown, and WAHA WA broadcast only goes to selected participants' parents.

**Architecture:** Add a `ScheduleParticipant` join model so each schedule has its own student list (independent of class enrollment). Admin creates a schedule, selects which enrolled students attend this session via react-select multi-select, and on publish the WA blast only targets those participants' parents. Tutor marks attendance from the participant list, not class-wide enrollments. Parent submits excuses before class via existing flow — no new "parent confirmation" step needed.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, PostgreSQL, react-select (new dep), TypeScript, Tailwind CSS, WAHA WhatsApp API.

**Attendance flow (unchanged):**
- WA broadcast → parent notified → parent can submit excuse (SICK/PERMISSION) via portal
- Tutor → marks PRESENT/ABSENT after class via attendance form
- No "parent confirmation" step added

---

## File Map

**New files:**
- `components/common/MultiSelect.tsx` — react-select wrapper component, reusable

**Modified files:**
- `prisma/schema.prisma` — add `ScheduleParticipant` model + relations on `Schedule` and `Student`
- `app/api/schedules/route.ts` — POST accepts `studentIds[]`, creates participants after schedule
- `app/api/schedules/[id]/route.ts` — GET includes `participants` with student data
- `app/api/schedules/[id]/publish/route.ts` — broadcast to `participants` instead of `class.enrollments`
- `app/(dashboard)/admin/schedules/page.tsx` — add multi-select students field, handle class → students loading
- `app/(dashboard)/tutor/attendance/[scheduleId]/page.tsx` — use `participants` as student list instead of `class.enrollments`

---

## Task 1: Add `ScheduleParticipant` to Prisma Schema + Migrate

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `participants` relation to `Schedule` model**

In `prisma/schema.prisma`, find the `Schedule` model. Add this line after `reports LearningReport[]`:
```prisma
participants ScheduleParticipant[]
```

- [ ] **Step 2: Add `scheduleParticipants` relation to `Student` model**

In `prisma/schema.prisma`, find the `Student` model. Add this line after `invoices Invoice[]`:
```prisma
scheduleParticipants ScheduleParticipant[]
```

- [ ] **Step 3: Add the `ScheduleParticipant` model**

Add this new model after the `Attendance` model:
```prisma
model ScheduleParticipant {
  id         String   @id @default(cuid())
  scheduleId String
  studentId  String
  schedule   Schedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  student    Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@unique([scheduleId, studentId])
}
```

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name add_schedule_participants
```

Expected output:
```
✔ Your database is now in sync with your schema.
Generated Prisma Client
```

- [ ] **Step 5: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add ScheduleParticipant model for per-session student selection"
```

---

## Task 2: Update `POST /api/schedules` — Accept `studentIds`, Create Participants

**Files:**
- Modify: `app/api/schedules/route.ts`

Current file accepts `classId, date, startTime, endTime, topic?, location?`. New version also accepts `studentIds: string[]` and creates `ScheduleParticipant` records after creating the schedule.

- [ ] **Step 1: Replace the file content**

Write this complete file to `app/api/schedules/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const createScheduleSchema = z.object({
  classId: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  topic: z.string().optional(),
  location: z.string().optional(),
  studentIds: z.array(z.string().min(1)).min(1, 'Pilih minimal 1 siswa'),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const classId = searchParams.get('classId')

  let schedules
  if (role === 'TUTOR') {
    schedules = await prisma.schedule.findMany({
      where: { class: { tutorId: userId }, ...(classId ? { classId } : {}) },
      include: {
        class: { include: { tutor: { select: { name: true } } } },
        _count: { select: { participants: true } },
      },
      orderBy: { date: 'desc' },
    })
  } else if (role === 'PARENT') {
    schedules = await prisma.schedule.findMany({
      where: {
        status: 'PUBLISHED',
        participants: { some: { student: { parentId: userId } } },
        ...(classId ? { classId } : {}),
      },
      include: {
        class: { include: { tutor: { select: { name: true } } } },
        _count: { select: { participants: true } },
      },
      orderBy: { date: 'desc' },
    })
  } else {
    schedules = await prisma.schedule.findMany({
      where: classId ? { classId } : {},
      include: {
        class: { include: { tutor: { select: { name: true } } } },
        _count: { select: { participants: true } },
      },
      orderBy: { date: 'desc' },
    })
  }

  return NextResponse.json(schedules)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { studentIds, ...scheduleData } = parsed.data

  const schedule = await prisma.schedule.create({
    data: { ...scheduleData, date: new Date(scheduleData.date) },
  })

  await prisma.scheduleParticipant.createMany({
    data: studentIds.map((studentId) => ({ scheduleId: schedule.id, studentId })),
    skipDuplicates: true,
  })

  return NextResponse.json(schedule, { status: 201 })
}
```

- [ ] **Step 2: Verify the file saved correctly**

Read `app/api/schedules/route.ts` and confirm `studentIds` is in the schema and `scheduleParticipant.createMany` is called.

- [ ] **Step 3: Commit**

```bash
git add app/api/schedules/route.ts
git commit -m "feat: update POST /api/schedules to accept studentIds and create participants"
```

---

## Task 3: Update `GET /api/schedules/[id]` — Include Participants

**Files:**
- Modify: `app/api/schedules/[id]/route.ts`

The GET needs to return `participants` with student data so the tutor attendance page can list students.

- [ ] **Step 1: Update the GET handler's Prisma include**

In `app/api/schedules/[id]/route.ts`, find the `prisma.schedule.findUnique` call in the GET handler. The current include is:
```typescript
include: {
  class: {
    include: {
      tutor: { select: { name: true, email: true } },
      enrollments: { include: { student: true } },
    },
  },
  attendances: { include: { student: true } },
}
```

Replace with:
```typescript
include: {
  class: {
    include: {
      tutor: { select: { name: true, email: true } },
    },
  },
  participants: {
    include: {
      student: { select: { id: true, name: true, grade: true } },
    },
    orderBy: { student: { name: 'asc' } },
  },
  attendances: { include: { student: true } },
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/schedules/[id]/route.ts"
git commit -m "feat: include participants in GET /api/schedules/[id] response"
```

---

## Task 4: Update Publish Route — Broadcast to Participants Only

**Files:**
- Modify: `app/api/schedules/[id]/publish/route.ts`

Currently broadcasts to `class.enrollments`. Must change to broadcast to `schedule.participants`.

- [ ] **Step 1: Read current file to understand exact structure**

Read `app/api/schedules/[id]/publish/route.ts` — note the Prisma include and the broadcast loop.

- [ ] **Step 2: Replace the Prisma query to fetch participants instead of enrollments**

Find the `prisma.schedule.findUnique` call. The current include is:
```typescript
include: {
  class: {
    include: {
      tutor: { select: { name: true } },
      enrollments: {
        include: {
          student: {
            include: {
              parent: { select: { name: true, phone: true } },
            },
          },
        },
      },
    },
  },
}
```

Replace with:
```typescript
include: {
  class: {
    include: {
      tutor: { select: { name: true } },
    },
  },
  participants: {
    include: {
      student: {
        include: {
          parent: { select: { name: true, phone: true } },
        },
      },
    },
  },
}
```

- [ ] **Step 3: Update the broadcast loop**

Find this line:
```typescript
const enrollments = scheduleWithDetails.class.enrollments
```
Delete it. Find the loop that uses `enrollments`:
```typescript
for (const e of enrollments) {
  const parent = e.student.parent
  if (!parent.phone) continue
  const message = `Halo Bunda/Ayah ${parent.name}, ...`
  ...
  const success = await sendWhatsApp(parent.phone, message)
  ...
}
```

Replace the `for` loop variable from `e` to `p` and source from `participants`:
```typescript
for (const p of scheduleWithDetails.participants) {
  const parent = p.student.parent
  if (!parent.phone) continue

  const message = `Halo Bunda/Ayah ${parent.name},

Berikut adalah jadwal belajar untuk ${p.student.name} besok:
🏫 Kelas: ${scheduleWithDetails.class.name}
👨‍🏫 Tutor: ${scheduleWithDetails.class.tutor.name}
🕐 Waktu: ${dateStr}, ${timeStr}${topicStr}${locationStr}

Sistem secara otomatis menjadwalkan ${p.student.name} untuk hadir. Jika berhalangan (sakit/izin), silakan hubungi kami dengan membalas pesan ini atau ajukan di portal akademik.

Terima kasih,
Mellyna Education`

  console.log(`[WAHA Broadcast] Sending schedule notification to parent ${parent.name} (${parent.phone})`)
  const success = await sendWhatsApp(parent.phone, message)
  if (success) {
    console.log(`[WAHA Broadcast] Successfully sent to ${parent.name}`)
  } else {
    console.error(`[WAHA Broadcast] Failed to send to ${parent.name}`)
  }
}
```

Note: `dateStr`, `timeStr`, `topicStr`, `locationStr` are already defined above the loop — keep them as-is.

- [ ] **Step 4: Also update the n8n internal endpoint**

In `app/api/internal/schedule-notify/[id]/route.ts`, the current code uses `class.enrollments` to build recipients. Update the `prisma.schedule.findUnique` include:

Current:
```typescript
include: {
  class: {
    include: {
      enrollments: {
        include: {
          student: {
            include: { parent: { select: { name: true, phone: true } } },
          },
        },
      },
    },
  },
}
```

Replace with:
```typescript
include: {
  class: { select: { name: true } },
  participants: {
    include: {
      student: {
        include: { parent: { select: { name: true, phone: true } } },
      },
    },
  },
}
```

Also update the `recipients` mapping from:
```typescript
const recipients = schedule.class.enrollments.map((e) => ({
  studentName: e.student.name,
  parentName: e.student.parent.name,
  parentPhone: e.student.parent.phone,
  ...
}))
```
To:
```typescript
const recipients = schedule.participants.map((p) => ({
  studentName: p.student.name,
  parentName: p.student.parent.name,
  parentPhone: p.student.parent.phone,
  topic: schedule.topic,
  date: schedule.date,
  startTime: schedule.startTime,
  endTime: schedule.endTime,
  className: schedule.class.name,
}))
```

- [ ] **Step 5: Commit**

```bash
git add "app/api/schedules/[id]/publish/route.ts" "app/api/internal/schedule-notify/[id]/route.ts"
git commit -m "feat: broadcast WA to schedule participants instead of all class enrollments"
```

---

## Task 5: Install react-select + Create `MultiSelect` Component

**Files:**
- Create: `components/common/MultiSelect.tsx`

react-select v5 is a Select2-equivalent for React with built-in TypeScript support.

- [ ] **Step 1: Install react-select**

```bash
npm install react-select
```

Expected: `added X packages`

- [ ] **Step 2: Create the MultiSelect component**

Write `components/common/MultiSelect.tsx`:

```tsx
'use client'

import Select, { MultiValue, StylesConfig } from 'react-select'

export interface SelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  options: SelectOption[]
  value: SelectOption[]
  onChange: (selected: SelectOption[]) => void
  placeholder?: string
  isLoading?: boolean
  isDisabled?: boolean
  noOptionsMessage?: string
}

const selectStyles: StylesConfig<SelectOption, true> = {
  control: (base, state) => ({
    ...base,
    borderRadius: '0.75rem',
    borderColor: state.isFocused ? '#6366f1' : '#e2e8f0',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(99, 102, 241, 0.1)' : 'none',
    '&:hover': { borderColor: '#6366f1' },
    fontSize: '0.875rem',
    minHeight: '42px',
    backgroundColor: 'white',
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: '#eef2ff',
    borderRadius: '0.375rem',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: '#4f46e5',
    fontSize: '0.75rem',
    fontWeight: '600',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: '#4f46e5',
    borderRadius: '0 0.375rem 0.375rem 0',
    '&:hover': { backgroundColor: '#c7d2fe', color: '#3730a3' },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '0.75rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
    zIndex: 50,
    overflow: 'hidden',
  }),
  menuList: (base) => ({
    ...base,
    padding: '4px',
  }),
  option: (base, state) => ({
    ...base,
    borderRadius: '0.5rem',
    backgroundColor: state.isSelected ? '#6366f1' : state.isFocused ? '#eef2ff' : 'white',
    color: state.isSelected ? 'white' : '#1e293b',
    fontSize: '0.875rem',
    cursor: 'pointer',
    padding: '8px 12px',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#94a3b8',
    fontSize: '0.875rem',
  }),
  noOptionsMessage: (base) => ({
    ...base,
    fontSize: '0.875rem',
    color: '#94a3b8',
  }),
}

export default function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  isLoading = false,
  isDisabled = false,
  noOptionsMessage = 'Tidak ada opsi tersedia',
}: MultiSelectProps) {
  return (
    <Select<SelectOption, true>
      isMulti
      options={options}
      value={value}
      onChange={(selected: MultiValue<SelectOption>) => onChange(selected as SelectOption[])}
      placeholder={placeholder}
      isLoading={isLoading}
      isDisabled={isDisabled}
      styles={selectStyles}
      noOptionsMessage={() => noOptionsMessage}
      loadingMessage={() => 'Memuat...'}
      closeMenuOnSelect={false}
      isClearable={false}
      instanceId="multi-select-students"
    />
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/common/MultiSelect.tsx package.json package-lock.json
git commit -m "feat: add react-select MultiSelect component for multi-student selection"
```

---

## Task 6: Update Admin Schedules Page — Multi-Select Students

**Files:**
- Modify: `app/(dashboard)/admin/schedules/page.tsx`

Current form fields: `classId, date, startTime, endTime, topic, location`. New form adds student multi-select that loads enrolled students when a class is selected.

**Context about current page:** `classes` state is already fetched from `GET /api/classes` which now includes `enrollments: [{ id, student: { id, name, grade } }]` (from previous implementation). So no extra API call needed to get students — they're already in the `classes` state.

- [ ] **Step 1: Add `SelectOption` import and `MultiSelect` import**

At the top of `app/(dashboard)/admin/schedules/page.tsx`, add:
```typescript
import MultiSelect, { SelectOption } from '@/components/common/MultiSelect'
```

- [ ] **Step 2: Update the `Schedule` interface to include participant count**

Find the `Schedule` interface at the top of the file:
```typescript
interface Schedule {
  id: string
  date: string
  startTime: string
  endTime: string
  topic: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED'
  class: { name: string; tutor: { name: string } }
}
```

Replace with:
```typescript
interface Schedule {
  id: string
  date: string
  startTime: string
  endTime: string
  topic: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED'
  class: { name: string; tutor: { name: string } }
  _count?: { participants: number }
}
```

- [ ] **Step 3: Add `Class` interface with enrollments**

After the `Schedule` interface, add:
```typescript
interface ClassWithEnrollments {
  id: string
  name: string
  tutor: { name: string }
  enrollments?: Array<{
    id: string
    student: { id: string; name: string; grade: string | null }
  }>
}
```

- [ ] **Step 4: Update `classes` state type**

Find:
```typescript
const [classes, setClasses] = useState<any[]>([])
```
Replace with:
```typescript
const [classes, setClasses] = useState<ClassWithEnrollments[]>([])
```

- [ ] **Step 5: Add student selection state**

After the existing `const [classes, setClasses]` line, add:
```typescript
const [studentOptions, setStudentOptions] = useState<SelectOption[]>([])
const [selectedStudents, setSelectedStudents] = useState<SelectOption[]>([])
```

- [ ] **Step 6: Add a handler that resets student options when class changes**

After the existing state declarations and before `fetchSchedules`, add:
```typescript
const handleClassChange = (classId: string) => {
  setForm((prev) => ({ ...prev, classId }))
  setSelectedStudents([])
  if (!classId) {
    setStudentOptions([])
    return
  }
  const cls = classes.find((c) => c.id === classId)
  if (cls?.enrollments) {
    const opts: SelectOption[] = cls.enrollments.map((e) => ({
      value: e.student.id,
      label: `${e.student.name}${e.student.grade ? ` (${e.student.grade})` : ''}`,
    }))
    setStudentOptions(opts)
    setSelectedStudents(opts) // default: select all enrolled students
  }
}
```

- [ ] **Step 7: Update the form's classId `<select>` onChange**

In the form JSX, find the class select element:
```tsx
onChange={(e) => setForm({ ...form, classId: e.target.value })}
```
Replace with:
```tsx
onChange={(e) => handleClassChange(e.target.value)}
```

- [ ] **Step 8: Add the student multi-select field to the form**

In the form JSX, after the existing `location` input field (inside the `<form>` grid), add a new full-width field for student selection:

```tsx
<div className="sm:col-span-2 lg:col-span-3">
  <label className="block text-xs font-semibold text-slate-600 mb-1">
    Peserta Kelas *{' '}
    <span className="text-slate-400 font-normal normal-case">
      (pilih dari siswa terdaftar di kelas)
    </span>
  </label>
  {!form.classId ? (
    <div className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-400 bg-slate-50">
      Pilih kelas terlebih dahulu untuk melihat daftar siswa
    </div>
  ) : studentOptions.length === 0 ? (
    <div className="rounded-xl border border-amber-200 px-3 py-2.5 text-sm text-amber-600 bg-amber-50">
      ⚠️ Kelas ini belum memiliki siswa terdaftar. Daftarkan siswa ke kelas terlebih dahulu.
    </div>
  ) : (
    <MultiSelect
      options={studentOptions}
      value={selectedStudents}
      onChange={setSelectedStudents}
      placeholder="Cari dan pilih siswa yang akan mengikuti sesi ini..."
    />
  )}
  {selectedStudents.length > 0 && (
    <p className="text-xs text-slate-500 mt-1">
      {selectedStudents.length} siswa dipilih dari {studentOptions.length} yang terdaftar
    </p>
  )}
</div>
```

- [ ] **Step 9: Update `handleSubmit` to include `studentIds`**

In the `handleSubmit` function, find:
```typescript
const res = await fetch('/api/schedules', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(form),
})
```
Replace with:
```typescript
if (selectedStudents.length === 0) {
  setError('Pilih minimal 1 siswa untuk sesi ini.')
  setSaving(false)
  return
}

const res = await fetch('/api/schedules', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...form,
    studentIds: selectedStudents.map((s) => s.value),
  }),
})
```

- [ ] **Step 10: Reset `selectedStudents` on form cancel/success**

In `handleSubmit` after the success path (where `setShowForm(false)` is called), add:
```typescript
setSelectedStudents([])
setStudentOptions([])
```

Also in the cancel button's `onClick`, find:
```typescript
onClick={() => setShowForm(false)}
```
Replace with:
```typescript
onClick={() => { setShowForm(false); setSelectedStudents([]); setStudentOptions([]) }}
```

- [ ] **Step 11: Update the schedule table to show participant count**

In the table, find the column headers array:
```tsx
{['Kelas', 'Tanggal', 'Jam', 'Topik', 'Tutor', 'Status', ''].map(...)}
```
Replace with:
```tsx
{['Kelas', 'Tanggal', 'Jam', 'Topik', 'Tutor', 'Peserta', 'Status', ''].map(...)}
```

In the table rows, find the `<td>` for topic (after date/time cells) and after the tutor cell, add a participants cell:
```tsx
<td className="px-6 py-4 text-slate-500 text-sm">
  {s._count?.participants ?? '-'} siswa
</td>
```

Place this cell after the tutor `<td>` and before the status `<td>`.

- [ ] **Step 12: Commit**

```bash
git add "app/(dashboard)/admin/schedules/page.tsx"
git commit -m "feat: add multi-select student picker to schedule creation form"
```

---

## Task 7: Update Tutor Attendance Page — Use Participants

**Files:**
- Modify: `app/(dashboard)/tutor/attendance/[scheduleId]/page.tsx`

Currently gets students via `schedData.class?.enrollments?.map((e: any) => e.student)`. With the new flow, `participants` is the authoritative student list for a session.

- [ ] **Step 1: Update the students extraction in `fetchData`**

Read `app/(dashboard)/tutor/attendance/[scheduleId]/page.tsx` to understand exact structure.

Find this line (inside `fetchData`):
```typescript
const students: Student[] = schedData.class?.enrollments?.map((e: any) => e.student) || []
```
Replace with:
```typescript
const students: Student[] = (schedData.participants ?? schedData.class?.enrollments ?? []).map(
  (p: any) => p.student
)
```

This prefers `participants` when present (new schedules), falls back to `enrollments` for any old schedules that don't have participants yet.

- [ ] **Step 2: Also update the JSX students extraction**

Find this line further down (inside the component return, before the table):
```typescript
const students: Student[] = schedule?.class?.enrollments?.map((e: any) => e.student) || []
```
Replace with:
```typescript
const students: Student[] = ((schedule?.participants ?? schedule?.class?.enrollments) ?? []).map(
  (p: any) => p.student
)
```

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/tutor/attendance/[scheduleId]/page.tsx"
git commit -m "feat: use schedule participants as student list in tutor attendance page"
```

---

## Self-Review Checklist

After implementation, verify:

- [ ] `prisma migrate dev` ran successfully — `ScheduleParticipant` table exists in DB
- [ ] `POST /api/schedules` without `studentIds` returns 400 validation error
- [ ] `POST /api/schedules` with `studentIds` creates schedule + participant records
- [ ] `GET /api/schedules/[id]` returns `participants` array with student data
- [ ] Admin schedules page: selecting a class populates student options in multi-select
- [ ] Admin schedules page: multi-select shows all enrolled students selected by default
- [ ] Admin schedules page: can deselect individual students
- [ ] Admin schedules page: saving with 0 students selected shows error "Pilih minimal 1 siswa"
- [ ] Admin schedules page: "Peserta" column shows count in the list
- [ ] Publish button: WA broadcast sent only to selected participants' parents (not all class enrollments)
- [ ] Tutor attendance page: shows participants list (not class-wide enrollments)
- [ ] Old schedules (no participants): tutor attendance page falls back to class enrollments gracefully

---

## Post-Migration Note

Existing schedules already in the DB will have zero participants (new table is empty). Those old schedules will show "0 peserta" in the admin list. The tutor attendance page will fall back to class enrollments for backward compatibility (Task 7 step 1-2).

For production, run a backfill to populate `ScheduleParticipant` from existing class enrollments:
```typescript
// One-time migration script (run via: npx ts-node prisma/backfill-participants.ts)
const schedules = await prisma.schedule.findMany({
  include: { class: { include: { enrollments: true } } }
})
for (const s of schedules) {
  await prisma.scheduleParticipant.createMany({
    data: s.class.enrollments.map((e) => ({ scheduleId: s.id, studentId: e.studentId })),
    skipDuplicates: true,
  })
}
```
