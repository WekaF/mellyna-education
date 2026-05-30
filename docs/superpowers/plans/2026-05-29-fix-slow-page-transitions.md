# Fix Slow Page Transitions — SSR Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the blank-screen waterfall on every dashboard page by converting from "client-side fetch on mount" to Next.js Server Components with Client Islands.

**Architecture:** Currently every page is `'use client'` → `useEffect` → `fetch('/api/...')` → setState. This makes Next.js behave like a plain React SPA: blank screen → hydrate → fetch → render. Fix: `page.tsx` becomes an `async` Server Component that calls Prisma directly; interactive UI is extracted to `*Client.tsx` islands that receive `initialData` as props.

**Tech Stack:** Next.js 15 App Router, React Server Components, Prisma ORM, next-auth JWT strategy

---

## Root Cause Summary

| Cause | Impact | Fix |
|-------|--------|-----|
| All 15 pages are `'use client'` + `useEffect fetch` | **CRITICAL** — every navigation shows loading spinner | Convert to Server Components |
| 11 of 15 pages missing `loading.tsx` | HIGH — blank white screen during navigation | Add loading skeletons |
| No client-side cache | MEDIUM — re-fetches on every back-navigation | `useState(initialData)` eliminates initial fetch |
| Layout calls `getServerSession` uncached | LOW — minor overhead (JWT strategy = no DB call) | Wrap in React `cache()` |

---

## File Structure

**New files:**
- `lib/session.ts` — cached `getSession()` helper (deduplicates across layout + pages in same request)
- `app/(dashboard)/admin/students/StudentsClient.tsx` — interactive island (extracted from current page.tsx)
- `app/(dashboard)/admin/tutors/TutorsClient.tsx`
- `app/(dashboard)/admin/billing/BillingClient.tsx`
- `app/(dashboard)/admin/schedules/SchedulesClient.tsx`
- `app/(dashboard)/admin/parents/ParentsClient.tsx`
- `app/(dashboard)/admin/classes/ClassesClient.tsx`
- `app/(dashboard)/admin/reports/ReportsClient.tsx`
- `app/(dashboard)/admin/announcements/AnnouncementsClient.tsx`
- `app/(dashboard)/admin/pricing/PricingClient.tsx`
- `app/(dashboard)/admin/analytics/AnalyticsClient.tsx`
- `app/(dashboard)/admin/timetable/TimetableClient.tsx`
- `app/(dashboard)/admin/financial-report/FinancialReportClient.tsx`
- `app/(dashboard)/admin/settings/SettingsClient.tsx`
- `app/(dashboard)/parent/billing/BillingClient.tsx`
- `app/(dashboard)/parent/schedule/ScheduleClient.tsx`
- `app/(dashboard)/parent/progress/ProgressClient.tsx`
- `app/(dashboard)/admin/parents/loading.tsx`
- `app/(dashboard)/admin/classes/loading.tsx`
- `app/(dashboard)/admin/reports/loading.tsx`
- `app/(dashboard)/admin/announcements/loading.tsx`
- `app/(dashboard)/admin/pricing/loading.tsx`
- `app/(dashboard)/admin/analytics/loading.tsx`
- `app/(dashboard)/admin/timetable/loading.tsx`
- `app/(dashboard)/admin/financial-report/loading.tsx`
- `app/(dashboard)/admin/settings/loading.tsx`
- `app/(dashboard)/parent/billing/loading.tsx`
- `app/(dashboard)/parent/schedule/loading.tsx`
- `app/(dashboard)/parent/progress/loading.tsx`

**Modified files:**
- `lib/auth.ts` — no change needed (JWT strategy already fast)
- `app/(dashboard)/layout.tsx` — use `getSession()` from `lib/session.ts`
- `app/(dashboard)/admin/students/page.tsx` — becomes Server Component
- `app/(dashboard)/admin/tutors/page.tsx` — becomes Server Component
- `app/(dashboard)/admin/billing/page.tsx` — becomes Server Component
- `app/(dashboard)/admin/schedules/page.tsx` — becomes Server Component
- `app/(dashboard)/admin/parents/page.tsx` — becomes Server Component
- `app/(dashboard)/admin/classes/page.tsx` — becomes Server Component
- `app/(dashboard)/admin/reports/page.tsx` — becomes Server Component
- `app/(dashboard)/admin/announcements/page.tsx` — becomes Server Component
- `app/(dashboard)/admin/pricing/page.tsx` — becomes Server Component
- `app/(dashboard)/admin/analytics/page.tsx` — becomes Server Component
- `app/(dashboard)/admin/timetable/page.tsx` — becomes Server Component
- `app/(dashboard)/admin/financial-report/page.tsx` — becomes Server Component
- `app/(dashboard)/admin/settings/page.tsx` — becomes Server Component
- `app/(dashboard)/parent/billing/page.tsx` — becomes Server Component
- `app/(dashboard)/parent/schedule/page.tsx` — becomes Server Component
- `app/(dashboard)/parent/progress/page.tsx` — becomes Server Component

---

## The Client Island Pattern (READ FIRST)

Every page conversion follows this exact pattern. Understand it once, apply it everywhere.

**Before** (current — slow):
```tsx
// page.tsx
'use client'
export default function SomePage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/something').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])
  // ... render
}
```

**After** (fast — SSR + Client Island):
```tsx
// page.tsx (Server Component — NO 'use client')
import { prisma } from '@/lib/db'
import SomeClient from './SomeClient'

export default async function SomePage() {
  const data = await prisma.something.findMany({ orderBy: { createdAt: 'desc' } })
  return <SomeClient initialData={data} />
}

// SomeClient.tsx
'use client'
export default function SomeClient({ initialData }: { initialData: Something[] }) {
  const [data, setData] = useState(initialData) // ← initialized from SSR data, no initial fetch!
  const [loading, setLoading] = useState(false)  // ← false! data is already here

  // REMOVE the useEffect that fetched initial data
  // KEEP useEffect only for things that truly need client-side fetch (e.g. filter changes)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/something')
      setData(await res.json())
    } finally { setLoading(false) }
  }, [])

  // After mutations, call refresh() to get fresh data
  // ...
}
```

**Key differences:**
1. `page.tsx` has NO `'use client'` — it's a Server Component
2. Prisma is called directly in `page.tsx`, NOT via API route
3. `*Client.tsx` receives `initialData` prop and uses `useState(initialData)`
4. `loading` starts as `false` — data is already available
5. Remove the `useEffect(() => { fetch... }, [])` that ran on mount
6. Mutations still call API routes and then call `refresh()` to re-fetch

---

## Task 1: Create Shared Session Helper

**Files:**
- Create: `lib/session.ts`
- Modify: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create `lib/session.ts`**

```ts
import { cache } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export const getSession = cache(() => getServerSession(authOptions))
```

- [ ] **Step 2: Update layout to use cached session**

In `app/(dashboard)/layout.tsx`, change line 4 import from:
```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
```
to:
```tsx
import { getSession } from '@/lib/session'
```

And change line 13 from:
```tsx
const session = await getServerSession(authOptions)
```
to:
```tsx
const session = await getSession()
```

- [ ] **Step 3: Commit**
```bash
git add lib/session.ts app/\(dashboard\)/layout.tsx
git commit -m "perf: add cached getSession helper to deduplicate auth in layout"
```

---

## Task 2: Add Missing `loading.tsx` Files

**Files:**
- Create: 11 `loading.tsx` files for pages missing them

The `loading.tsx` in `app/(dashboard)/admin/schedules/loading.tsx` already has a great TableSkeleton pattern. Import and reuse it.

- [ ] **Step 1: Check what TableSkeleton accepts**

Read `components/common/DataTable.tsx` and find the `TableSkeleton` export. Note its props: `columns: number` and `rows: number`.

- [ ] **Step 2: Create `app/(dashboard)/admin/parents/loading.tsx`**

```tsx
import { TableSkeleton } from '@/components/common/DataTable'

export default function ParentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        </div>
      </div>
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        <TableSkeleton columns={5} rows={6} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create the remaining 10 loading files**

Create identical files for each path below (adjust `columns` count to match the page's table):

| Path | columns | rows |
|------|---------|------|
| `app/(dashboard)/admin/classes/loading.tsx` | 4 | 6 |
| `app/(dashboard)/admin/reports/loading.tsx` | 5 | 6 |
| `app/(dashboard)/admin/announcements/loading.tsx` | 3 | 6 |
| `app/(dashboard)/admin/pricing/loading.tsx` | 4 | 6 |
| `app/(dashboard)/admin/analytics/loading.tsx` | 5 | 8 |
| `app/(dashboard)/admin/timetable/loading.tsx` | 5 | 6 |
| `app/(dashboard)/admin/financial-report/loading.tsx` | 4 | 6 |
| `app/(dashboard)/admin/settings/loading.tsx` | 1 | 3 |
| `app/(dashboard)/parent/billing/loading.tsx` | 4 | 6 |
| `app/(dashboard)/parent/schedule/loading.tsx` | 4 | 6 |
| `app/(dashboard)/parent/progress/loading.tsx` | 4 | 6 |

Use the same template as Step 2 — just change the component name and columns/rows numbers.

- [ ] **Step 4: Commit**
```bash
git add app/\(dashboard\)/
git commit -m "perf: add missing loading.tsx skeletons to all dashboard pages"
```

---

## Task 3: Convert `admin/students` to Server Component

This is the reference implementation. Follow this pattern exactly for all other pages.

**Files:**
- Modify: `app/(dashboard)/admin/students/page.tsx`
- Create: `app/(dashboard)/admin/students/StudentsClient.tsx`

- [ ] **Step 1: Create `StudentsClient.tsx` with full current page code**

Create `app/(dashboard)/admin/students/StudentsClient.tsx`. Copy the ENTIRE content of the current `page.tsx` into this file, then make these two changes:

1. Change the first line from `'use client'` to `'use client'` (keep it)
2. Change the function signature to accept `initialStudents` and `parents` props:

```tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, MessageCircle, UserX, UserCheck } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/common/DataTable'

interface Student {
  id: string
  name: string
  grade: string | null
  createdAt: string
  parentId: string
  isActive: boolean
  parent: { name: string; email: string; phone: string | null }
}

interface StudentsClientProps {
  initialStudents: Student[]
  parents: { id: string; name: string; email: string }[]
}

export default function StudentsClient({ initialStudents, parents: initialParents }: StudentsClientProps) {
  const [students, setStudents] = useState<Student[]>(initialStudents) // ← SSR data, no fetch needed
  const [loading, setLoading] = useState(false)                        // ← false! already have data
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', grade: '', parentId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parents, setParents] = useState(initialParents)               // ← SSR data
  // ... keep all other state the same

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/students')
      setStudents(await res.json())
    } catch {
      setError('Gagal memuat data siswa.')
    } finally {
      setLoading(false)
    }
  }, [])

  // REMOVE the useEffect that called fetchStudents() and fetchParents() on mount
  // Keep all other useEffects if any

  // ... rest of the handlers stay EXACTLY the same (handleSubmit, handleDelete, etc.)
  // ... columns definition stays EXACTLY the same
  // ... return JSX stays EXACTLY the same
}
```

The key changes are:
- Function accepts `{ initialStudents, parents: initialParents }` props
- `useState<Student[]>(initialStudents)` instead of `useState<Student[]>([])`
- `useState(false)` for loading instead of `useState(true)`
- `useState(initialParents)` for parents instead of `useState([])`
- **Delete** the `useEffect(() => { fetchStudents(); fetchParents() }, [...])` block

- [ ] **Step 2: Rewrite `page.tsx` as Server Component**

Replace the entire content of `app/(dashboard)/admin/students/page.tsx` with:

```tsx
import { prisma } from '@/lib/db'
import StudentsClient from './StudentsClient'

export default async function AdminStudentsPage() {
  const [students, parents] = await Promise.all([
    prisma.student.findMany({
      include: { parent: { select: { name: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where: { role: 'PARENT' },
      select: { id: true, name: true, email: true },
    }),
  ])

  return <StudentsClient initialStudents={students} parents={parents} />
}
```

Note: No `'use client'`, no session check (layout handles auth), direct Prisma call.

- [ ] **Step 3: Fix TypeScript date serialization**

Prisma returns `Date` objects but the client component interface expects `string` for `createdAt`. Fix by serializing in the Server Component:

```tsx
export default async function AdminStudentsPage() {
  const [rawStudents, parents] = await Promise.all([
    prisma.student.findMany({
      include: { parent: { select: { name: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where: { role: 'PARENT' },
      select: { id: true, name: true, email: true },
    }),
  ])

  const students = rawStudents.map(s => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
  }))

  return <StudentsClient initialStudents={students} parents={parents} />
}
```

- [ ] **Step 4: Verify no TypeScript errors**

Run:
```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -50
```

Expected: zero errors related to students page. Fix any type mismatches before continuing.

- [ ] **Step 5: Test in browser**

Navigate to `/admin/students`. Expected behavior:
- Page loads with student data immediately (no loading spinner on first visit)
- Add/edit/delete still works
- After add/edit/delete, data refreshes correctly

- [ ] **Step 6: Commit**
```bash
git add app/\(dashboard\)/admin/students/
git commit -m "perf: convert admin/students to Server Component with Client Island"
```

---

## Task 4: Convert `admin/tutors` to Server Component

**Files:**
- Modify: `app/(dashboard)/admin/tutors/page.tsx`
- Create: `app/(dashboard)/admin/tutors/TutorsClient.tsx`

- [ ] **Step 1: Create `TutorsClient.tsx`**

Copy all content from `app/(dashboard)/admin/tutors/page.tsx` to `TutorsClient.tsx`. Then:

Change function signature to:
```tsx
interface TutorsClientProps {
  initialTutors: {
    id: string
    name: string
    email: string
    phone: string | null
    suspended: boolean
    createdAt: string
  }[]
}

export default function TutorsClient({ initialTutors }: TutorsClientProps) {
  const [tutors, setTutors] = useState(initialTutors) // ← from SSR
  const [loading, setLoading] = useState(false)        // ← false, data already here
  // ... rest unchanged
```

Delete the `useEffect(() => { fetchTutors() }, [fetchTutors])` block.

- [ ] **Step 2: Rewrite `page.tsx` as Server Component**

```tsx
import { prisma } from '@/lib/db'
import TutorsClient from './TutorsClient'

export default async function AdminTutorsPage() {
  const rawTutors = await prisma.user.findMany({
    where: { role: 'TUTOR' },
    select: { id: true, name: true, email: true, phone: true, suspended: true, createdAt: true },
    orderBy: { name: 'asc' },
  })

  const tutors = rawTutors.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }))

  return <TutorsClient initialTutors={tutors} />
}
```

- [ ] **Step 3: Verify and test**

Run `npx tsc --noEmit 2>&1 | head -30`. Navigate to `/admin/tutors` — data shows immediately.

- [ ] **Step 4: Commit**
```bash
git add app/\(dashboard\)/admin/tutors/
git commit -m "perf: convert admin/tutors to Server Component with Client Island"
```

---

## Task 5: Convert `admin/billing` to Server Component

The billing page has filter state (month/year/classId). Strategy: Server Component loads current data (no filter = last 30 days of invoices), client keeps filter-based re-fetching when user changes filters.

**Files:**
- Modify: `app/(dashboard)/admin/billing/page.tsx`
- Create: `app/(dashboard)/admin/billing/BillingClient.tsx`

- [ ] **Step 1: Create `BillingClient.tsx`**

Copy all content from `app/(dashboard)/admin/billing/page.tsx` to `BillingClient.tsx`. Change function signature:

```tsx
interface BillingClientProps {
  initialInvoices: {
    id: string
    description: string
    amount: number
    dueDate: string
    status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
    createdAt: string
    student: { name: string }
  }[]
  initialStudents: { id: string; name: string; grade: string | null }[]
  initialClasses: { id: string; name: string; tutor: { name: string } }[]
}

export default function BillingClient({ initialInvoices, initialStudents, initialClasses }: BillingClientProps) {
  const [invoices, setInvoices] = useState(initialInvoices)     // ← from SSR
  const [loading, setLoading] = useState(false)                  // ← false
  const [studentList, setStudentList] = useState(initialStudents)
  const [classList, setClassList] = useState(initialClasses)
  // ... rest unchanged
```

Delete the three `useEffect` blocks that do the initial fetches for invoices, students, and classes. Keep any other useEffect blocks (e.g., filter change effects if any).

- [ ] **Step 2: Rewrite `page.tsx` as Server Component**

```tsx
import { prisma } from '@/lib/db'
import BillingClient from './BillingClient'

export default async function AdminBillingPage() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [rawInvoices, rawStudents, classes] = await Promise.all([
    prisma.invoice.findMany({
      where: { createdAt: { gte: startOfMonth } },
      include: { student: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.student.findMany({
      where: { isActive: true },
      select: { id: true, name: true, grade: true },
      orderBy: { name: 'asc' },
    }),
    prisma.class.findMany({
      select: { id: true, name: true, tutor: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
  ])

  const invoices = rawInvoices.map(inv => ({
    ...inv,
    dueDate: inv.dueDate.toISOString(),
    createdAt: inv.createdAt.toISOString(),
  }))

  return (
    <BillingClient
      initialInvoices={invoices}
      initialStudents={rawStudents}
      initialClasses={classes}
    />
  )
}
```

- [ ] **Step 3: Verify and test**

Run `npx tsc --noEmit 2>&1 | head -30`. Navigate to `/admin/billing` — current month invoices show immediately. Changing filters still triggers API fetch (existing behavior preserved).

- [ ] **Step 4: Commit**
```bash
git add app/\(dashboard\)/admin/billing/
git commit -m "perf: convert admin/billing to Server Component with Client Island"
```

---

## Task 6: Convert Remaining Admin Pages (schedules, parents, classes, reports, announcements)

Apply the same pattern from Task 3 for each page below. For each page:
1. Read the current `page.tsx`
2. Copy to `*Client.tsx`, change signature to accept `initial*` props, change `useState([])` → `useState(initialData)`, change `useState(true)` → `useState(false)`, delete initial fetch `useEffect`
3. Rewrite `page.tsx` as Server Component with Prisma query

**`admin/schedules/page.tsx`** — Prisma query for Server Component:
```tsx
import { prisma } from '@/lib/db'
import SchedulesClient from './SchedulesClient'

export default async function AdminSchedulesPage() {
  const [rawSchedules, classes, tutors] = await Promise.all([
    prisma.schedule.findMany({
      include: {
        class: { select: { name: true } },
        tutor: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.class.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { role: 'TUTOR' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])

  const schedules = rawSchedules.map(s => ({
    ...s,
    date: s.date.toISOString(),
    createdAt: s.createdAt.toISOString(),
  }))

  return <SchedulesClient initialSchedules={schedules} classes={classes} tutors={tutors} />
}
```

**`admin/parents/page.tsx`** — Read the current page.tsx to see what API call it makes (likely `/api/admin/parents`), then mirror that Prisma query. The Prisma query is in `app/api/admin/parents/route.ts` GET handler.

**`admin/classes/page.tsx`** — Read `app/api/classes/route.ts` GET handler for the Prisma query. Mirror it.

**`admin/reports/page.tsx`** — Read `app/api/reports/route.ts` GET handler. Mirror it.

**`admin/announcements/page.tsx`** — Read `app/api/announcements/route.ts` GET handler. Mirror it.

- [ ] **Step 1: Convert `admin/schedules`** — follow pattern, use query above
- [ ] **Step 2: Read `app/api/admin/parents/route.ts` GET, then convert `admin/parents`**
- [ ] **Step 3: Read `app/api/classes/route.ts` GET, then convert `admin/classes`**
- [ ] **Step 4: Read `app/api/reports/route.ts` GET, then convert `admin/reports`**
- [ ] **Step 5: Read `app/api/announcements/route.ts` GET, then convert `admin/announcements`**
- [ ] **Step 6: Run type check after all 5 conversions**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -50
```

Fix any type errors. Common issue: `Date` from Prisma vs `string` in interface — always `.toISOString()` in Server Component.

- [ ] **Step 7: Commit**
```bash
git add app/\(dashboard\)/admin/
git commit -m "perf: convert schedules/parents/classes/reports/announcements to Server Components"
```

---

## Task 7: Convert Remaining Admin Pages (pricing, analytics, timetable, financial-report, settings)

Same pattern. The analytics page calls multiple endpoints — mirror all 3 queries in a `Promise.all`.

**`admin/analytics/page.tsx`** — reads from 3 API endpoints:
- `/api/admin/analytics/attendance` → read `app/api/admin/analytics/attendance/route.ts` GET
- `/api/admin/analytics/tutors` → read `app/api/admin/analytics/tutors/route.ts` GET  
- `/api/admin/analytics/students` → read `app/api/admin/analytics/students/route.ts` GET

Server Component:
```tsx
import { prisma } from '@/lib/db'
import AnalyticsClient from './AnalyticsClient'

export default async function AdminAnalyticsPage() {
  // Read the three route.ts files to get the exact Prisma queries
  // Then run them in Promise.all and pass as initialData to AnalyticsClient
  // The AnalyticsClient will use initialTab='attendance' and all 3 datasets
  const [attendanceStats, tutorStats, studentStats] = await Promise.all([
    // mirror app/api/admin/analytics/attendance/route.ts GET query
    // mirror app/api/admin/analytics/tutors/route.ts GET query
    // mirror app/api/admin/analytics/students/route.ts GET query
  ])
  return <AnalyticsClient initialAttendance={attendanceStats} initialTutors={tutorStats} initialStudents={studentStats} />
}
```

For `AnalyticsClient`, the tab switching (`attendance` | `tutors` | `students`) currently triggers a fetch per tab. After SSR, all 3 datasets are preloaded — no per-tab fetches needed at all. Initialize all 3 with the SSR data.

- [ ] **Step 1: Read the 3 analytics API route files to get exact Prisma queries**
- [ ] **Step 2: Convert `admin/analytics`** with all 3 datasets preloaded
- [ ] **Step 3: Read `app/api` routes for pricing, timetable, financial-report, settings**
- [ ] **Step 4: Convert `admin/pricing`** — mirror its GET query
- [ ] **Step 5: Convert `admin/timetable`** — mirror its GET query
- [ ] **Step 6: Convert `admin/financial-report`** — mirror its GET query (check if it exists or if page uses multiple endpoints)
- [ ] **Step 7: Convert `admin/settings`** — this page likely fetches user settings, mirror the query
- [ ] **Step 8: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -50
```

- [ ] **Step 9: Commit**
```bash
git add app/\(dashboard\)/admin/
git commit -m "perf: convert analytics/pricing/timetable/financial-report/settings to Server Components"
```

---

## Task 8: Convert Parent Dashboard Pages

**Files:**
- `app/(dashboard)/parent/billing/page.tsx` + `BillingClient.tsx`
- `app/(dashboard)/parent/schedule/page.tsx` + `ScheduleClient.tsx`  
- `app/(dashboard)/parent/progress/page.tsx` + `ProgressClient.tsx`

Parent pages need the current user's ID to filter data. Get it from session in the Server Component:

```tsx
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import ParentBillingClient from './BillingClient'

export default async function ParentBillingPage() {
  const session = await getSession()
  const userId = (session!.user as any).id

  const rawInvoices = await prisma.invoice.findMany({
    where: { student: { parentId: userId } },
    include: { student: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const invoices = rawInvoices.map(inv => ({
    ...inv,
    dueDate: inv.dueDate.toISOString(),
    createdAt: inv.createdAt.toISOString(),
  }))

  return <ParentBillingClient initialInvoices={invoices} />
}
```

- [ ] **Step 1: Read current `parent/billing/page.tsx` and its API route to get query**
- [ ] **Step 2: Convert `parent/billing`** with user-scoped Prisma query
- [ ] **Step 3: Read current `parent/schedule/page.tsx` and its API route**
- [ ] **Step 4: Convert `parent/schedule`**
- [ ] **Step 5: Read current `parent/progress/page.tsx` and its API route**
- [ ] **Step 6: Convert `parent/progress`**
- [ ] **Step 7: Run type check and test all 3 parent pages**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -50
```

- [ ] **Step 8: Commit**
```bash
git add app/\(dashboard\)/parent/
git commit -m "perf: convert parent billing/schedule/progress to Server Components"
```

---

## Task 9: Verify All Pages Work Correctly

- [ ] **Step 1: Build the project locally**

```bash
npm run build 2>&1 | tail -40
```

Expected: successful build. Fix any build errors (usually missing imports or type mismatches).

- [ ] **Step 2: Start production build locally**

```bash
npm start
```

- [ ] **Step 3: Test each page in browser**

Navigate to each page and verify:
- [ ] `/admin` — dashboard loads with data
- [ ] `/admin/students` — student list shows immediately, add/edit/delete work
- [ ] `/admin/tutors` — tutor list shows immediately
- [ ] `/admin/billing` — current month invoices show immediately, filters still work
- [ ] `/admin/schedules` — schedule list shows immediately
- [ ] `/admin/parents` — parent list shows immediately
- [ ] `/admin/classes` — class list shows immediately
- [ ] `/admin/reports` — reports show immediately
- [ ] `/admin/announcements` — announcements show immediately
- [ ] `/admin/analytics` — all 3 tabs show data immediately (no per-tab loading)
- [ ] `/admin/pricing` — pricing data shows immediately
- [ ] `/admin/timetable` — timetable shows immediately
- [ ] `/admin/financial-report` — report shows immediately
- [ ] `/admin/settings` — settings show immediately
- [ ] `/parent/billing` — parent invoices show immediately
- [ ] `/parent/schedule` — schedule shows immediately
- [ ] `/parent/progress` — progress shows immediately

- [ ] **Step 4: Verify mutations still work**

On `/admin/students`: add a student, edit a student, delete a student. All should work and data should refresh.

- [ ] **Step 5: Final commit**
```bash
git add -A
git commit -m "perf: complete SSR migration — all dashboard pages now use Server Components"
```

---

## Expected Result After This Plan

| Before | After |
|--------|-------|
| Navigate to page → blank screen → 300-1500ms spinner | Navigate to page → instant data render |
| Every page visit re-fetches from API | Initial render uses SSR data; re-fetches only after mutations |
| "Feels like a React SPA" | Actual Next.js SSR — data arrives with HTML |
| 11 pages show blank screen during navigation | Loading skeletons on every page |

The difference will be dramatic: going from `/admin/students` to `/admin/tutors` will feel instant because the data renders server-side before the HTML reaches the browser.
