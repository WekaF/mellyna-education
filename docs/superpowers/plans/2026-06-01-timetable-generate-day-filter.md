# Timetable Generate Day-Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow superadmin to select specific days when generating/broadcasting timetable schedules, instead of always generating all 7 days.

**Architecture:** Add `selectedDays: DayOfWeek[]` to the generate modal form state (default: all 7 days checked). Pass it to the existing `/api/admin/timetable/generate` route. API filters the class query by `dayOfWeek in selectedDays`. If `selectedDays` is empty or absent, fall back to all days (backward compatible). No schema changes.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Prisma

---

## File Map

| File | Change |
|------|--------|
| `app/(dashboard)/admin/timetable/TimetableClient.tsx` | Add `selectedDays` to `generateForm` state; add day-toggle buttons in generate modal |
| `app/api/admin/timetable/generate/route.ts` | Read `selectedDays` from request body; filter `findMany` query by those days |
| `__tests__/api/admin/timetable-generate-day-filter.test.ts` | New: test that only selected days' classes are generated |

---

### Task 1: Add day-selector to generate modal UI

**Files:**
- Modify: `app/(dashboard)/admin/timetable/TimetableClient.tsx`

**Context:**
`generateForm` state is `{ startDate: string }` (line ~118). The modal has a date input and submit buttons. We add `selectedDays` to the form and render 7 toggle buttons (Mon–Sun) between the date input and the submit row. `DAYS` array is already defined at file top (line 8–16) — reuse it.

- [ ] **Step 1: Extend `generateForm` state to include `selectedDays`**

Find the state declaration (around line 118):
```typescript
const [generateForm, setGenerateForm] = useState({
  startDate: '',
})
```

Replace with:
```typescript
const [generateForm, setGenerateForm] = useState<{
  startDate: string
  selectedDays: DayOfWeek[]
}>({
  startDate: '',
  selectedDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
})
```

- [ ] **Step 2: Add day-toggle buttons to generate modal JSX**

Find the generate modal date input block (around line 1084–1100):
```tsx
<div>
  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Pilih Tanggal dalam Minggu Target *</label>
  <input
    required
    type="date"
    ...
  />
  <p className="text-[10px] text-slate-400 mt-1">Pilih hari mana saja dalam minggu yang dituju...</p>
</div>
```

Add this block **after** that `<div>` and **before** the submit button row:

```tsx
{/* Day selector */}
<div>
  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
    Hari yang Di-generate &amp; Di-broadcast *
  </label>
  <div className="flex flex-wrap gap-1.5">
    {DAYS.map(d => {
      const selected = generateForm.selectedDays.includes(d.key)
      return (
        <button
          key={d.key}
          type="button"
          onClick={() => {
            const days = generateForm.selectedDays
            setGenerateForm({
              ...generateForm,
              selectedDays: selected
                ? days.filter(k => k !== d.key)
                : [...days, d.key],
            })
          }}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer flex items-center gap-1 ${
            selected
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
          }`}
        >
          {selected && <Check className="h-3 w-3" />}
          {d.label}
        </button>
      )
    })}
  </div>
  {generateForm.selectedDays.length === 0 && (
    <p className="text-[10px] text-red-500 mt-1.5 font-semibold">Pilih minimal 1 hari.</p>
  )}
  <p className="text-[10px] text-slate-400 mt-1.5">
    Uncheck hari yang ingin dilewati. Hanya hari yang dipilih yang akan di-generate dan di-broadcast.
  </p>
</div>
```

- [ ] **Step 3: Disable submit button when no days selected**

Find the submit button in the generate modal (around line 1097):
```tsx
<button
  type="submit"
  disabled={generating}
  ...
>
```

Add `|| generateForm.selectedDays.length === 0` to disabled:
```tsx
<button
  type="submit"
  disabled={generating || generateForm.selectedDays.length === 0}
  ...
>
```

- [ ] **Step 4: No test needed for this UI step — commit**

```bash
git add app/(dashboard)/admin/timetable/TimetableClient.tsx
git commit -m "feat: add day-selector to timetable generate modal"
```

---

### Task 2: Filter generate API by selected days

**Files:**
- Modify: `app/api/admin/timetable/generate/route.ts`
- Create: `__tests__/api/admin/timetable-generate-day-filter.test.ts`

**Context:**
The API currently loads ALL classes with `dayOfWeek: { not: null }` (line ~79). We need to accept `selectedDays` from request body and filter the `findMany` query. If `selectedDays` absent or empty, fall back to all days (no behavior change for old callers).

- [ ] **Step 1: Write failing test**

Create `__tests__/api/admin/timetable-generate-day-filter.test.ts`:

```typescript
import { POST } from '@/app/api/admin/timetable/generate/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

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

const mockSession = { user: { role: 'SUPER_ADMIN' } }

function makeClass(dayOfWeek: string, id: string) {
  return {
    id,
    name: `Kelas ${id}`,
    dayOfWeek,
    timeSlot: '08:00',
    tutor: { name: 'Budi', phone: null },
    additionalTutors: [],
    programs: [{ program: 'SEMPOA' }],
    enrollments: [],
  }
}

describe('POST /api/admin/timetable/generate - day filter', () => {
  beforeEach(() => jest.clearAllMocks())

  it('only generates classes for selectedDays', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    // Simulate DB returning only MONDAY classes (because API filters by selectedDays)
    ;(prisma.class.findMany as jest.Mock).mockResolvedValue([makeClass('MONDAY', 'c1')])
    ;(prisma.schedule.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.schedule.create as jest.Mock).mockResolvedValue({
      id: 's1', date: new Date('2026-06-01'), participants: [],
    })

    const req = new Request('http://localhost/api/admin/timetable/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-06-01', selectedDays: ['MONDAY'] }),
    })
    const res = await POST(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.created).toBe(1)

    // Verify findMany was called with dayOfWeek filter containing only MONDAY
    const findManyCall = (prisma.class.findMany as jest.Mock).mock.calls[0][0]
    expect(findManyCall.where.dayOfWeek).toEqual({ not: null, in: ['MONDAY'] })
  })

  it('generates all days when selectedDays not provided (backward compat)', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.class.findMany as jest.Mock).mockResolvedValue([])

    const req = new Request('http://localhost/api/admin/timetable/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-06-01' }),
    })
    await POST(req as any)

    const findManyCall = (prisma.class.findMany as jest.Mock).mock.calls[0][0]
    // When no selectedDays, filter should be all 7 days
    expect(findManyCall.where.dayOfWeek.in).toHaveLength(7)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/admin/timetable-generate-day-filter.test.ts --no-coverage
```

Expected: FAIL — `findManyCall.where.dayOfWeek` does not have `in` property

- [ ] **Step 3: Update generate API to read and apply `selectedDays`**

In `app/api/admin/timetable/generate/route.ts`, find the body parsing section (around line 56–70) and the `findMany` call (around line 79):

**Update body parsing** — change:
```typescript
const { startDate } = body
```
to:
```typescript
const { startDate, selectedDays } = body

const ALL_DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
const daysFilter: DayOfWeek[] = Array.isArray(selectedDays) && selectedDays.length > 0
  ? (selectedDays as string[]).filter(d => ALL_DAYS.includes(d as DayOfWeek)) as DayOfWeek[]
  : ALL_DAYS
```

Note: `DayOfWeek` is imported from `@prisma/client` at top of file — use it.

**Update findMany query** — change:
```typescript
const classes = await prisma.class.findMany({
  where: { dayOfWeek: { not: null }, timeSlot: { not: null } },
```
to:
```typescript
const classes = await prisma.class.findMany({
  where: { dayOfWeek: { not: null, in: daysFilter }, timeSlot: { not: null } },
```

Also update the log line (around line 70) to include the day filter:
```typescript
console.log(`[Timetable Generator] Input date ${startDate} → week of ${weekLabel}, days: ${daysFilter.join(', ')}`)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/admin/timetable-generate-day-filter.test.ts --no-coverage
```

Expected: PASS (2/2)

- [ ] **Step 5: Run all timetable tests**

```bash
npx jest __tests__/api/admin/timetable --no-coverage
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/timetable/generate/route.ts __tests__/api/admin/timetable-generate-day-filter.test.ts
git commit -m "feat: filter timetable generate by selectedDays"
```

---

## Self-Review

| Requirement | Task |
|-------------|------|
| Pilih hari tertentu (e.g. hanya Senin) | Task 1 + Task 2 |
| Default semua hari checked | Task 1 (default array) |
| Backward compat (tanpa selectedDays = semua hari) | Task 2 |
| Disable submit jika 0 hari | Task 1 |
| Test coverage | Task 2 |

No placeholders. Types consistent. `DayOfWeek` used from `@prisma/client` in both frontend (line 6) and API (already imported).
