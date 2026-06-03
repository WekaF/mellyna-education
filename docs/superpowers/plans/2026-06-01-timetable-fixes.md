# Timetable Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two timetable bugs: (1) enrollment add/remove broken by multi-program support, and (2) generate form should default to yesterday and accept any day.

**Architecture:**
- Bug 1 (enrollment): `findFirst` on programEnrollment returns wrong program when student has multiple active programs → change to `findMany`, find matching program. UI also silently swallows API error → add modal-level error state.
- Bug 2 (generate date): Form hardcodes default to "next Monday" and label implies Monday-only → change default to yesterday, allow any date, calculate Monday server-side.

**Tech Stack:** Next.js 14 App Router, Prisma, React, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `app/api/enrollments/route.ts` | `findFirst` → `findMany`, match any active program |
| `app/(dashboard)/admin/timetable/TimetableClient.tsx` | Add `enrollError` state, show in modal; change generate default to yesterday |
| `app/api/admin/timetable/generate/route.ts` | Accept any date, calculate Monday of that week |

---

### Task 1: Fix enrollment API — support multiple active programs

**Files:**
- Modify: `app/api/enrollments/route.ts`

**Context:**
Recent commits added support for multiple active programs per student. The enrollment POST still uses `findFirst` which returns one arbitrary active program. If that program doesn't match the class, it returns 422 — blocking enrollment even when the student has a matching program.

- [ ] **Step 1: Write failing test**

Create `__tests__/api/enrollments-multi-program.test.ts`:

```typescript
import { POST } from '@/app/api/enrollments/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

jest.mock('next-auth')
jest.mock('@/lib/db', () => ({ prisma: { programEnrollment: { findMany: jest.fn() }, classProgram: { findMany: jest.fn() }, enrollment: { upsert: jest.fn() } } }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockSession = { user: { role: 'SUPER_ADMIN' } }

describe('POST /api/enrollments - multi-program', () => {
  it('enrolls student whose second active program matches class', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.programEnrollment.findMany as jest.Mock).mockResolvedValue([
      { id: 'pe1', program: 'SEMPOA', studentId: 's1' },
      { id: 'pe2', program: 'MATEMATIKA', studentId: 's1' },
    ])
    ;(prisma.classProgram.findMany as jest.Mock).mockResolvedValue([
      { program: 'MATEMATIKA' },
    ])
    ;(prisma.enrollment.upsert as jest.Mock).mockResolvedValue({ id: 'e1', studentId: 's1', classId: 'c1' })

    const req = new Request('http://localhost/api/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 's1', classId: 'c1' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
  })

  it('returns 422 when no active program matches class', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.programEnrollment.findMany as jest.Mock).mockResolvedValue([
      { id: 'pe1', program: 'SEMPOA', studentId: 's1' },
    ])
    ;(prisma.classProgram.findMany as jest.Mock).mockResolvedValue([
      { program: 'MATEMATIKA' },
    ])

    const req = new Request('http://localhost/api/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 's1', classId: 'c1' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(422)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/enrollments-multi-program.test.ts --no-coverage
```

Expected: FAIL — `prisma.programEnrollment.findMany` is not a function (because production code uses `findFirst`)

- [ ] **Step 3: Fix the enrollment API**

Replace `app/api/enrollments/route.ts` lines 33–57:

```typescript
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
```

Then update the `upsert` to use `matchingEnrollment`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/enrollments-multi-program.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/enrollments/route.ts __tests__/api/enrollments-multi-program.test.ts
git commit -m "fix: support multiple active programs when enrolling student to class"
```

---

### Task 2: Fix enrollment UI — show API error inside the modal

**Files:**
- Modify: `app/(dashboard)/admin/timetable/TimetableClient.tsx`

**Context:**
`handleToggleEnrollment` catches errors but only calls `setError` (page-level state). This error is shown at the top of the page, not inside the modal — user can't see it. Also, the API error message (e.g. "Program aktif siswa...") is never read from the response.

- [ ] **Step 1: Add `enrollError` state near the other enrollment modal state**

Find the block around line 111:

```typescript
// Enrollments Modal state
const [showEnrollModal, setShowEnrollModal] = useState(false)
const [enrollClass, setEnrollClass] = useState<ClassModel | null>(null)
const [studentSearch, setStudentSearch] = useState('')
```

Add `enrollError`:

```typescript
// Enrollments Modal state
const [showEnrollModal, setShowEnrollModal] = useState(false)
const [enrollClass, setEnrollClass] = useState<ClassModel | null>(null)
const [studentSearch, setStudentSearch] = useState('')
const [enrollError, setEnrollError] = useState<string | null>(null)
```

- [ ] **Step 2: Update `handleToggleEnrollment` to read and surface the API error**

Replace the current `handleToggleEnrollment` (around lines 405–441) with:

```typescript
const handleToggleEnrollment = async (student: Student) => {
  if (!enrollClass) return
  setEnrollError(null)
  const isEnrolled = enrollClass.enrollments.find(e => e.studentId === student.id)

  try {
    if (isEnrolled) {
      const res = await fetch(`/api/enrollments/${isEnrolled.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Gagal menghapus pendaftaran.')
      }
    } else {
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          classId: enrollClass.id,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Gagal mendaftarkan siswa.')
      }
    }

    const classesRes = await fetch('/api/classes')
    const updatedClasses = await classesRes.json()
    setClasses(updatedClasses)

    const updatedClass = updatedClasses.find((c: ClassModel) => c.id === enrollClass.id)
    setEnrollClass(updatedClass || null)
  } catch (err: any) {
    setEnrollError(err.message || 'Gagal memperbarui pendaftaran siswa.')
  }
}
```

- [ ] **Step 3: Show `enrollError` inside the enrollment modal**

Find the modal footer (around line 1041):

```tsx
<div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
  <span className="text-slate-500 font-bold">Terdaftar: {enrollClass.enrollments.length} Siswa</span>
```

Add the error display just before the footer `<div>`:

```tsx
{enrollError && (
  <div className="px-4 py-2.5 bg-red-50 dark:bg-red-950/20 border-t border-red-100 dark:border-red-900/40 text-red-700 dark:text-red-400 text-xs font-semibold">
    {enrollError}
  </div>
)}
<div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
  <span className="text-slate-500 font-bold">Terdaftar: {enrollClass.enrollments.length} Siswa</span>
```

- [ ] **Step 4: Clear `enrollError` when modal opens**

Find `handleOpenEnrollModal` or where `setShowEnrollModal(true)` is called. Add `setEnrollError(null)` alongside the modal open:

```typescript
setEnrollError(null)
setShowEnrollModal(true)
```

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/admin/timetable/TimetableClient.tsx
git commit -m "fix: show enrollment API error message inside the modal"
```

---

### Task 3: Fix generate form — default yesterday + accept any day

**Files:**
- Modify: `app/(dashboard)/admin/timetable/TimetableClient.tsx`

**Context:**
The `useEffect` at line 123–131 defaults `startDate` to "next Monday". The form label says "Tanggal Mulai Minggu (Senin)" implying Monday-only. User wants default = yesterday, and wants to pick any day.

- [ ] **Step 1: Change default to yesterday**

Replace the `useEffect` (lines 123–131):

```typescript
// Set default to yesterday for generation
useEffect(() => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  setGenerateForm({ startDate: yesterday.toISOString().split('T')[0] })
}, [])
```

- [ ] **Step 2: Update label and hint text in the generate modal**

Find (around line 1084–1093):

```tsx
<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Tanggal Mulai Minggu (Senin) *</label>
```
```tsx
<p className="text-[10px] text-slate-400 mt-1">Sesi akan dijadwalkan dari Senin s.d. Minggu di minggu tersebut.</p>
```

Replace with:

```tsx
<label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Pilih Tanggal dalam Minggu Target *</label>
```
```tsx
<p className="text-[10px] text-slate-400 mt-1">Pilih hari mana saja dalam minggu yang dituju. Sistem akan otomatis menghitung Senin s.d. Minggu di minggu tersebut.</p>
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/admin/timetable/TimetableClient.tsx
git commit -m "fix: change generate form default to yesterday, allow any day selection"
```

---

### Task 4: Fix generate API — calculate Monday from any input date

**Files:**
- Modify: `app/api/admin/timetable/generate/route.ts`

**Context:**
The API currently names the variable `baseMonday` and comments say "must be Monday". If a non-Monday is passed, offsets go wrong (e.g. Wednesday + `MONDAY: 0` = Wednesday, not the Monday of that week). We need to normalize any date to its Monday.

- [ ] **Step 1: Write failing test**

Add to `__tests__/api/admin/timetable-generate-multi-tutor.test.ts` or create `__tests__/api/admin/timetable-generate-any-day.test.ts`:

```typescript
// Test that Wednesday input gets normalized to Monday of that week
import { POST } from '@/app/api/admin/timetable/generate/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import * as waha from '@/lib/waha'

jest.mock('next-auth')
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/waha', () => ({
  getSessionStatus: jest.fn().mockResolvedValue('STOPPED'),
  sendWhatsApp: jest.fn(),
  sleep: jest.fn(),
  randomDelay: jest.fn().mockReturnValue(0),
}))
jest.mock('@/lib/db', () => ({
  prisma: {
    class: { findMany: jest.fn() },
    schedule: { findFirst: jest.fn(), create: jest.fn() },
  },
}))

describe('POST /api/admin/timetable/generate - any day input', () => {
  it('accepts a Wednesday and creates Monday-class schedule on correct Monday', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
    ;(prisma.class.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'c1',
        name: 'Kelas A',
        dayOfWeek: 'MONDAY',
        timeSlot: '08:00',
        tutor: { name: 'Budi', phone: null },
        additionalTutors: [],
        programs: [{ program: 'SEMPOA' }],
        enrollments: [],
      },
    ])
    ;(prisma.schedule.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.schedule.create as jest.Mock).mockResolvedValue({
      id: 's1',
      date: new Date('2026-06-01'), // Monday
      participants: [],
    })

    // Input: Wednesday 2026-06-03
    const req = new Request('http://localhost/api/admin/timetable/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-06-03' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)

    // Verify schedule.create was called with date = 2026-06-01 (Monday of that week)
    const createCall = (prisma.schedule.create as jest.Mock).mock.calls[0][0]
    const createdDate: Date = createCall.data.date
    expect(createdDate.toISOString().split('T')[0]).toBe('2026-06-01')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/admin/timetable-generate-any-day.test.ts --no-coverage
```

Expected: FAIL — created date is `2026-06-03` (Wednesday), not `2026-06-01` (Monday)

- [ ] **Step 3: Add Monday-normalization helper in generate route**

In `app/api/admin/timetable/generate/route.ts`, after the `getTimeRange` function, add:

```typescript
/** Return the Monday of the ISO week that `date` falls in. */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  // getDay(): 0=Sun, 1=Mon, ..., 6=Sat
  const dayOfWeek = d.getDay()
  // How many days back to reach Monday (Sunday → go back 6 days, Monday → 0, etc.)
  const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  d.setDate(d.getDate() - daysBack)
  return d
}
```

- [ ] **Step 4: Use the helper in the POST handler**

Replace (around line 52):

```typescript
const baseMonday = new Date(startDate)
if (isNaN(baseMonday.getTime())) {
  return NextResponse.json({ error: 'Format tanggal awal tidak valid.' }, { status: 400 })
}

console.log(`[Timetable Generator] Starting schedule generation from weekly timetable for week starting ${startDate}`)
```

With:

```typescript
const inputDate = new Date(startDate)
if (isNaN(inputDate.getTime())) {
  return NextResponse.json({ error: 'Format tanggal tidak valid.' }, { status: 400 })
}
const baseMonday = getMondayOfWeek(inputDate)
const weekLabel = baseMonday.toISOString().split('T')[0]

console.log(`[Timetable Generator] Input date ${startDate} → week of ${weekLabel}`)
```

Also update the error message at line 49:

```typescript
if (!startDate) {
  return NextResponse.json({ error: 'Tanggal wajib diisi.' }, { status: 400 })
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest __tests__/api/admin/timetable-generate-any-day.test.ts --no-coverage
```

Expected: PASS

- [ ] **Step 6: Run all timetable tests**

```bash
npx jest __tests__/api/admin/timetable --no-coverage
```

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/timetable/generate/route.ts __tests__/api/admin/timetable-generate-any-day.test.ts
git commit -m "fix: normalize any input date to Monday of that week in timetable generator"
```

---

## Self-Review

| Requirement | Task |
|-------------|------|
| Add/remove students broken → fix API | Task 1 |
| Error message not visible in modal | Task 2 |
| Generate default = yesterday | Task 3 |
| Generate accepts any day | Task 3 + Task 4 |

No placeholders. All tasks have real code. Types consistent across tasks.
