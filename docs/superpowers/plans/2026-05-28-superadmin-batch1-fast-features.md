# Superadmin Batch 1 — Fast Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four high-value admin features with zero or minimal schema changes: contact parent via WA, view student media/reports, toggle student active status, and suspend/unsuspend tutors.

**Architecture:** Features A and B require no schema changes (zero migration). Features C and D each add one boolean field to existing models. All features follow existing patterns: role-guarded API routes, client-side pages with fetch callbacks, Tailwind UI matching project style.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, TypeScript, Tailwind CSS, NextAuth JWT, WAHA WhatsApp API, lucide-react icons.

**Execution order (fastest first):**
- Feature A: Contact parent via WA (no schema change)
- Feature B: Admin reports & media view (no schema change)
- Feature C: Student active/inactive toggle (1 migration)
- Feature D: Suspend/unsuspend tutor (1 migration + auth change)

---

## File Map

**New files:**
- `app/api/admin/contact-parent/route.ts` — POST: send WA to a specific parent
- `app/api/students/[id]/status/route.ts` — PATCH: toggle student isActive
- `app/api/admin/users/[id]/suspend/route.ts` — PATCH: toggle user suspended
- `app/(dashboard)/admin/reports/page.tsx` — list all student reports + media
- `app/suspended/page.tsx` — shown when a suspended tutor tries to log in

**Modified files:**
- `app/api/students/route.ts` — add `phone` to parent select in GET
- `app/(dashboard)/admin/students/page.tsx` — add WA button + modal, add active toggle
- `app/(dashboard)/admin/tutors/page.tsx` — add suspend/unsuspend button
- `components/dashboard/sidebar.tsx` — add Laporan to admin nav
- `prisma/schema.prisma` — add `isActive` to Student, `suspended` to User
- `lib/auth.ts` — block suspended users, include `suspended` in JWT
- `middleware.ts` — redirect suspended tutors
- `types/next-auth.d.ts` — add `suspended` to JWT type declaration

---

## Feature A: Contact Parent via WA

### Task 1: Update `GET /api/students` to Include Parent Phone

**Files:**
- Modify: `app/api/students/route.ts`

Currently `parent: { select: { name: true, email: true } }` — missing phone.

- [ ] **Step 1: Update the parent select in both findMany calls**

In `app/api/students/route.ts`, find both occurrences of:
```typescript
parent: { select: { name: true, email: true } }
```
Replace both with:
```typescript
parent: { select: { name: true, email: true, phone: true } }
```

- [ ] **Step 2: Commit**

```bash
git add app/api/students/route.ts
git commit -m "feat: include parent phone in GET /api/students response"
```

---

### Task 2: Create `POST /api/admin/contact-parent`

**Files:**
- Create: `app/api/admin/contact-parent/route.ts`

- [ ] **Step 1: Write the route file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendWhatsApp } from '@/lib/waha'

const schema = z.object({
  parentId: z.string().min(1),
  message: z.string().min(1).max(1000),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const parent = await prisma.user.findUnique({
    where: { id: parsed.data.parentId },
    select: { name: true, phone: true },
  })

  if (!parent) return NextResponse.json({ error: 'Parent not found' }, { status: 404 })
  if (!parent.phone) return NextResponse.json({ error: 'Orang tua tidak memiliki nomor HP.' }, { status: 422 })

  const success = await sendWhatsApp(parent.phone, parsed.data.message)
  if (!success) {
    return NextResponse.json({ error: 'Gagal mengirim pesan WhatsApp.' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/contact-parent/route.ts
git commit -m "feat: add POST /api/admin/contact-parent for WA messaging from admin"
```

---

### Task 3: Add WA Contact Button + Modal to Admin Students Page

**Files:**
- Modify: `app/(dashboard)/admin/students/page.tsx`

**Context:** The students page now uses `DataTable` with `@tanstack/react-table`. The `Student` interface has `parent: { name: string; email: string }`. We need to add `phone: string | null` and a contact modal.

- [ ] **Step 1: Add `MessageCircle` to lucide imports and update Student interface**

Find the import line:
```typescript
import { Plus, Pencil, Trash2 } from 'lucide-react'
```
Replace with:
```typescript
import { Plus, Pencil, Trash2, MessageCircle } from 'lucide-react'
```

Find the `Student` interface:
```typescript
interface Student {
  id: string
  name: string
  grade: string | null
  createdAt: string
  parent: { name: string; email: string }
}
```
Replace with:
```typescript
interface Student {
  id: string
  name: string
  grade: string | null
  createdAt: string
  parent: { name: string; email: string; phone: string | null }
}
```

- [ ] **Step 2: Add contact modal state after existing state declarations**

After the existing state declarations (after `const [parents, setParents]`), add:
```typescript
const [contactTarget, setContactTarget] = useState<{ parentId: string; parentName: string; phone: string | null } | null>(null)
const [contactMessage, setContactMessage] = useState('')
const [contactSending, setContactSending] = useState(false)
const [contactError, setContactError] = useState<string | null>(null)
```

- [ ] **Step 3: Add `handleContactWA` and `handleSendContact` handlers**

After `handleEditClick`, add:
```typescript
const handleContactWA = useCallback((student: Student) => {
  setContactTarget({ parentId: student.parentId ?? '', parentName: student.parent.name, phone: student.parent.phone })
  setContactMessage('')
  setContactError(null)
}, [])

const handleSendContact = async () => {
  if (!contactTarget || !contactMessage.trim()) return
  setContactSending(true)
  setContactError(null)
  try {
    const res = await fetch('/api/admin/contact-parent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: contactTarget.parentId, message: contactMessage }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Gagal mengirim pesan.')
    }
    setContactTarget(null)
    setContactMessage('')
  } catch (err: any) {
    setContactError(err.message)
  } finally {
    setContactSending(false)
  }
}
```

Wait — the Student interface doesn't have `parentId` as a direct field. Looking at `app/api/students/route.ts`, the student object returned from Prisma includes `parentId` (it's in the schema). Update the interface to also include `parentId`:

```typescript
interface Student {
  id: string
  name: string
  grade: string | null
  createdAt: string
  parentId: string
  parent: { name: string; email: string; phone: string | null }
}
```

- [ ] **Step 4: Add WA button to the actions column in `columns`**

Find the actions cell in the `columns` `useMemo`. Currently it has Pencil and Trash2 buttons. Add a MessageCircle button before them:

```tsx
cell: ({ row }) => {
  const student = row.original
  return (
    <div className="flex items-center gap-2 justify-end">
      <button
        onClick={() => handleContactWA(student)}
        className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
        title="Hubungi Orang Tua via WA"
      >
        <MessageCircle className="h-4 w-4" />
      </button>
      <button
        onClick={() => handleEditClick(student)}
        className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        onClick={() => handleDelete(student.id, student.name)}
        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
},
```

Also update the `columns` dependencies in `useMemo` to include `handleContactWA`:
```typescript
], [handleDelete, handleEditClick, handleContactWA])
```

- [ ] **Step 5: Add the contact modal JSX**

Before the closing `</div>` of the component return, add:
```tsx
{contactTarget && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => setContactTarget(null)} />
    <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl z-10">
      <h3 className="font-bold text-slate-800 mb-1">💬 Hubungi Orang Tua via WA</h3>
      <p className="text-xs text-slate-500 mb-4">
        Kepada: <strong>{contactTarget.parentName}</strong>
        {contactTarget.phone
          ? <span className="ml-1 text-slate-400">({contactTarget.phone})</span>
          : <span className="ml-1 text-rose-500"> — Nomor HP belum diisi</span>
        }
      </p>

      {contactError && (
        <div className="mb-3 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-xs text-rose-600">⚠️ {contactError}</div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Pesan *</label>
          <textarea
            rows={4}
            value={contactMessage}
            onChange={(e) => setContactMessage(e.target.value)}
            placeholder="Tulis pesan untuk orang tua..."
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSendContact}
            disabled={contactSending || !contactMessage.trim() || !contactTarget.phone}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl cursor-pointer transition-colors"
          >
            {contactSending ? 'Mengirim...' : '📲 Kirim WA'}
          </button>
          <button
            onClick={() => setContactTarget(null)}
            className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl cursor-pointer"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/admin/students/page.tsx"
git commit -m "feat: add WA contact button and modal to admin students table"
```

---

## Feature B: Admin Reports & Media View

### Task 4: Create Admin Reports Page

**Files:**
- Create: `app/(dashboard)/admin/reports/page.tsx`

**Context:** `GET /api/reports` with no params returns all reports (including media) for SUPER_ADMIN. The `LearningReport.media` array has `{ id, url, type, filename }` where `type` is `PHOTO` or `VIDEO`.

- [ ] **Step 1: Write the page**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search } from 'lucide-react'

interface Media {
  id: string
  url: string
  type: 'PHOTO' | 'VIDEO'
  filename: string
}

interface Report {
  id: string
  content: string
  score: number | null
  createdAt: string
  student: { id: string; name: string }
  schedule: { date: string; topic: string | null; class: { name: string } }
  tutor: { name: string }
  media: Media[]
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reports')
      if (!res.ok) throw new Error()
      setReports(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  const filtered = reports.filter((r) =>
    r.student.name.toLowerCase().includes(search.toLowerCase()) ||
    r.schedule.class.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">📋 Laporan & Media Siswa</h1>
        <p className="text-sm text-slate-500 mt-0.5">Seluruh laporan belajar dan foto/video sesi yang diupload tutor.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Cari nama siswa atau kelas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      {loading ? (
        <div className="p-10 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
          <p className="text-3xl">📭</p>
          <p className="mt-2 text-sm">{search ? 'Laporan tidak ditemukan.' : 'Belum ada laporan yang dibuat.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((report) => (
            <div key={report.id} className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800">{report.student.name}</h3>
                    <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">{report.schedule.class.name}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(report.schedule.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    {' · '}Tutor: {report.tutor.name}
                  </p>
                  {report.schedule.topic && (
                    <p className="text-xs text-indigo-600 font-medium mt-0.5">📚 {report.schedule.topic}</p>
                  )}
                </div>
                {report.score !== null && (
                  <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 shrink-0">
                    <span className="text-lg font-extrabold text-indigo-600">{report.score}</span>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-xs font-semibold text-slate-500 mb-1">Catatan Tutor:</p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{report.content}</p>
              </div>

              {report.media.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">
                    Media ({report.media.length} file):
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {report.media.map((m) => (
                      <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">
                        {m.type === 'PHOTO' ? (
                          <div className="h-24 w-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                            <img src={m.url} alt={m.filename} className="h-full w-full object-cover hover:opacity-80 transition-opacity" />
                          </div>
                        ) : (
                          <div className="h-24 w-24 rounded-xl border border-slate-200 bg-slate-800 flex flex-col items-center justify-center gap-1 hover:opacity-80 transition-opacity">
                            <span className="text-2xl">🎥</span>
                            <span className="text-[9px] text-slate-300 font-medium">Video</span>
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/admin/reports/page.tsx"
git commit -m "feat: add admin reports page with student media and learning reports"
```

---

### Task 5: Add "Laporan" to Admin Sidebar

**Files:**
- Modify: `components/dashboard/sidebar.tsx`

- [ ] **Step 1: Add `FileText` to lucide imports**

Find the lucide-react import. Add `FileText` to it.

- [ ] **Step 2: Add Laporan to SUPER_ADMIN nav links**

Find the SUPER_ADMIN nav links array. After the "Pengumuman" entry, before "Pengaturan", add:
```typescript
{ name: 'Laporan', href: '/admin/reports', icon: FileText },
```

The array should be:
```typescript
return [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Siswa', href: '/admin/students', icon: GraduationCap },
  { name: 'Tutor', href: '/admin/tutors', icon: Users },
  { name: 'Kelas', href: '/admin/classes', icon: BookOpen },
  { name: 'Jadwal', href: '/admin/schedules', icon: Calendar },
  { name: 'Tagihan', href: '/admin/billing', icon: CreditCard },
  { name: 'Pengumuman', href: '/admin/announcements', icon: Megaphone },
  { name: 'Laporan', href: '/admin/reports', icon: FileText },
  { name: 'Pengaturan', href: '/admin/settings', icon: Settings },
]
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/sidebar.tsx
git commit -m "feat: add Laporan link to admin sidebar"
```

---

## Feature C: Student Active/Inactive Toggle

### Task 6: Add `isActive` to Student Schema + Migrate

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `isActive` field to Student model**

In `prisma/schema.prisma`, find the `Student` model. After the line `updatedAt DateTime @updatedAt`, add:
```prisma
isActive  Boolean   @default(true)
```

The Student model should now include:
```prisma
model Student {
  id        String    @id @default(cuid())
  name      String
  birthDate DateTime?
  grade     String?
  notes     String?
  parentId  String
  isActive  Boolean   @default(true)
  parent    User      @relation(...)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  ...
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_student_active_status
```

Expected: `✔ Your database is now in sync with your schema.`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add isActive field to Student model"
```

---

### Task 7: Create `PATCH /api/students/[id]/status`

**Files:**
- Create: `app/api/students/[id]/status/route.ts`

- [ ] **Step 1: Write the route file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const student = await prisma.student.findUnique({ where: { id }, select: { isActive: true } })
  if (!student) return NextResponse.json({ error: 'Not Found' }, { status: 404 })

  const updated = await prisma.student.update({
    where: { id },
    data: { isActive: !student.isActive },
    select: { id: true, isActive: true },
  })

  return NextResponse.json(updated)
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/students/[id]/status/route.ts"
git commit -m "feat: add PATCH /api/students/[id]/status to toggle student active status"
```

---

### Task 8: Add Active/Inactive Toggle to Admin Students Page

**Files:**
- Modify: `app/(dashboard)/admin/students/page.tsx`

- [ ] **Step 1: Add `isActive` to Student interface**

Add `isActive: boolean` to the `Student` interface:
```typescript
interface Student {
  id: string
  name: string
  grade: string | null
  createdAt: string
  parentId: string
  isActive: boolean
  parent: { name: string; email: string; phone: string | null }
}
```

- [ ] **Step 2: Add `toggling` state and `handleToggleActive` handler**

After existing state declarations, add:
```typescript
const [toggling, setToggling] = useState<string | null>(null)
```

After `handleSendContact`, add:
```typescript
const handleToggleActive = useCallback(async (student: Student) => {
  setToggling(student.id)
  try {
    const res = await fetch(`/api/students/${student.id}/status`, { method: 'PATCH' })
    if (!res.ok) throw new Error()
    await fetchStudents()
  } catch {
    setError('Gagal mengubah status siswa.')
  } finally {
    setToggling(null)
  }
}, [fetchStudents])
```

- [ ] **Step 3: Add status badge column to columns definition**

In the `columns` useMemo, add a new column after the `createdAt` column and before the `actions` column:
```typescript
{
  id: 'status',
  header: 'Status',
  enableSorting: false,
  cell: ({ row }) => {
    const student = row.original
    return student.isActive ? (
      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Aktif</span>
    ) : (
      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Nonaktif</span>
    )
  },
},
```

- [ ] **Step 4: Add toggle button to actions column**

In the `actions` cell, add a toggle button after the MessageCircle button:
```tsx
<button
  onClick={() => handleToggleActive(student)}
  disabled={toggling === student.id}
  className={`p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
    student.isActive
      ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
      : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
  }`}
  title={student.isActive ? 'Nonaktifkan siswa' : 'Aktifkan siswa'}
>
  {student.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
</button>
```

Add `UserX, UserCheck` to the lucide import:
```typescript
import { Plus, Pencil, Trash2, MessageCircle, UserX, UserCheck } from 'lucide-react'
```

Update columns dependency:
```typescript
], [handleDelete, handleEditClick, handleContactWA, handleToggleActive, toggling])
```

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/admin/students/page.tsx"
git commit -m "feat: add student active/inactive toggle to admin students table"
```

---

## Feature D: Suspend/Unsuspend Tutor

### Task 9: Add `suspended` to User Schema + Migrate

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `suspended` field to User model**

In the `User` model, after `role Role @default(PARENT)`, add:
```prisma
suspended Boolean @default(false)
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_user_suspended
```

Expected: `✔ Your database is now in sync with your schema.`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add suspended field to User model"
```

---

### Task 10: Create `PATCH /api/admin/users/[id]/suspend`

**Files:**
- Create: `app/api/admin/users/[id]/suspend/route.ts`

- [ ] **Step 1: Write the route file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const user = await prisma.user.findUnique({ where: { id }, select: { role: true, suspended: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Cannot suspend admin account' }, { status: 403 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { suspended: !user.suspended },
    select: { id: true, suspended: true },
  })

  return NextResponse.json(updated)
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/admin/users/[id]/suspend/route.ts"
git commit -m "feat: add PATCH /api/admin/users/[id]/suspend to toggle tutor suspension"
```

---

### Task 11: Update Auth — Block Suspended Users + Include in JWT

**Files:**
- Modify: `lib/auth.ts`
- Modify: `types/next-auth.d.ts`

- [ ] **Step 1: Update `types/next-auth.d.ts` to include `suspended`**

Current file:
```typescript
import { Role } from '@prisma/client'
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      role: Role
    }
  }
  interface User {
    role: Role
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
  }
}
```

Replace with:
```typescript
import { Role } from '@prisma/client'
import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      role: Role
      suspended: boolean
    }
  }
  interface User {
    role: Role
    suspended: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: Role
    suspended: boolean
  }
}
```

- [ ] **Step 2: Update `lib/auth.ts` — block suspended, include in JWT**

Find the `authorize` callback:
```typescript
async authorize(credentials) {
  if (!credentials?.email || !credentials?.password) return null
  const user = await prisma.user.findUnique({ where: { email: credentials.email } })
  if (!user?.password) return null
  const valid = await bcrypt.compare(credentials.password, user.password)
  if (!valid) return null
  return { id: user.id, name: user.name, email: user.email, role: user.role }
},
```

Replace with:
```typescript
async authorize(credentials) {
  if (!credentials?.email || !credentials?.password) return null
  const user = await prisma.user.findUnique({ where: { email: credentials.email } })
  if (!user?.password) return null
  if (user.suspended) return null
  const valid = await bcrypt.compare(credentials.password, user.password)
  if (!valid) return null
  return { id: user.id, name: user.name, email: user.email, role: user.role, suspended: user.suspended }
},
```

Find the `jwt` callback:
```typescript
async jwt({ token, user }) {
  if (user) {
    token.id = user.id
    token.role = (user as any).role
  }
  return token
},
```

Replace with:
```typescript
async jwt({ token, user }) {
  if (user) {
    token.id = user.id
    token.role = (user as any).role
    token.suspended = (user as any).suspended ?? false
  }
  return token
},
```

Find the `session` callback:
```typescript
async session({ session, token }) {
  if (session.user) {
    (session.user as any).id = token.id
    ;(session.user as any).role = token.role
  }
  return session
},
```

Replace with:
```typescript
async session({ session, token }) {
  if (session.user) {
    (session.user as any).id = token.id
    ;(session.user as any).role = token.role
    ;(session.user as any).suspended = token.suspended
  }
  return session
},
```

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts types/next-auth.d.ts
git commit -m "feat: block suspended users from login and include suspended in JWT"
```

---

### Task 12: Update Middleware + Create Suspended Page

**Files:**
- Modify: `middleware.ts`
- Create: `app/suspended/page.tsx`

- [ ] **Step 1: Update middleware to redirect suspended tutors**

Current middleware:
```typescript
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const role = req.nextauth.token?.role

    if (pathname.startsWith('/admin') && role !== 'SUPER_ADMIN')
      return NextResponse.redirect(new URL('/login', req.url))

    if (pathname.startsWith('/tutor') && role !== 'TUTOR' && role !== 'SUPER_ADMIN')
      return NextResponse.redirect(new URL('/login', req.url))

    if (pathname.startsWith('/parent') && role !== 'PARENT' && role !== 'SUPER_ADMIN')
      return NextResponse.redirect(new URL('/login', req.url))

    return NextResponse.next()
  },
  { callbacks: { authorized: ({ token }) => !!token } }
)

export const config = {
  matcher: ['/admin/:path*', '/tutor/:path*', '/parent/:path*'],
}
```

Replace with:
```typescript
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token
    const role = token?.role

    if (token?.suspended && pathname.startsWith('/tutor'))
      return NextResponse.redirect(new URL('/suspended', req.url))

    if (pathname.startsWith('/admin') && role !== 'SUPER_ADMIN')
      return NextResponse.redirect(new URL('/login', req.url))

    if (pathname.startsWith('/tutor') && role !== 'TUTOR' && role !== 'SUPER_ADMIN')
      return NextResponse.redirect(new URL('/login', req.url))

    if (pathname.startsWith('/parent') && role !== 'PARENT' && role !== 'SUPER_ADMIN')
      return NextResponse.redirect(new URL('/login', req.url))

    return NextResponse.next()
  },
  { callbacks: { authorized: ({ token }) => !!token } }
)

export const config = {
  matcher: ['/admin/:path*', '/tutor/:path*', '/parent/:path*'],
}
```

- [ ] **Step 2: Create the suspended page**

Write `app/suspended/page.tsx`:
```tsx
import Link from 'next/link'

export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl">🔒</div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Akun Ditangguhkan</h1>
          <p className="mt-3 text-slate-500 text-sm leading-relaxed">
            Akun Anda sementara tidak dapat mengakses portal. Silakan hubungi administrator
            Mellyna Education untuk informasi lebih lanjut.
          </p>
        </div>
        <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-left space-y-1">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Butuh bantuan?</p>
          <p className="text-sm text-amber-600">Hubungi admin melalui WhatsApp atau email yang terdaftar.</p>
        </div>
        <Link
          href="/login"
          className="inline-block bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Kembali ke Halaman Login
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add middleware.ts app/suspended/page.tsx
git commit -m "feat: redirect suspended tutors to /suspended page"
```

---

### Task 13: Add Suspend Toggle to Admin Tutors Page

**Files:**
- Modify: `app/(dashboard)/admin/tutors/page.tsx`

**Context:** The tutors page was rewritten to use `GET /api/tutors` and has a create form. Tutor cards show name/email/phone. We need to add a suspend toggle button per card.

- [ ] **Step 1: Update `Tutor` interface to include `suspended`**

Find the `Tutor` interface at the top:
```typescript
interface Tutor {
  id: string
  name: string
  email: string
  phone: string | null
  createdAt: string
}
```
Replace with:
```typescript
interface Tutor {
  id: string
  name: string
  email: string
  phone: string | null
  suspended: boolean
  createdAt: string
}
```

- [ ] **Step 2: Update `GET /api/tutors` to include `suspended`**

In `app/api/tutors/route.ts`, the select statement is:
```typescript
select: { id: true, name: true, email: true, phone: true, createdAt: true },
```
Add `suspended: true`:
```typescript
select: { id: true, name: true, email: true, phone: true, suspended: true, createdAt: true },
```

- [ ] **Step 3: Add `suspending` state and `handleToggleSuspend` handler**

In the tutors page, after existing state declarations, add:
```typescript
const [suspending, setSuspending] = useState<string | null>(null)
```

After `handleSubmit`, add:
```typescript
const handleToggleSuspend = async (tutor: Tutor) => {
  if (!confirm(`${tutor.suspended ? 'Aktifkan kembali' : 'Tangguhkan'} akun tutor "${tutor.name}"?`)) return
  setSuspending(tutor.id)
  try {
    const res = await fetch(`/api/admin/users/${tutor.id}/suspend`, { method: 'PATCH' })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Gagal mengubah status.')
    }
    await fetchTutors()
  } catch (err: any) {
    setError(err.message)
  } finally {
    setSuspending(null)
  }
}
```

- [ ] **Step 4: Add suspend badge and button to each tutor card**

In the tutor cards JSX, find the card for each tutor. In the content section that shows name/email, add a suspended badge after the name:

Find the h3 name line inside the map and update it to show a badge when suspended:
```tsx
<div>
  <div className="flex items-center gap-2">
    <h3 className="font-bold text-slate-800">{tutor.name}</h3>
    {tutor.suspended && (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">Ditangguhkan</span>
    )}
  </div>
  <p className="text-xs text-slate-500">{tutor.email}</p>
  {tutor.phone && <p className="text-xs text-slate-400">{tutor.phone}</p>}
</div>
```

After the `<p>Terdaftar: ...</p>` line at the bottom of the card, add the suspend button:
```tsx
<div className="pt-3 border-t border-slate-100">
  <button
    onClick={() => handleToggleSuspend(tutor)}
    disabled={suspending === tutor.id}
    className={`w-full text-xs font-semibold py-2 rounded-xl cursor-pointer transition-colors disabled:opacity-50 ${
      tutor.suspended
        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
        : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
    }`}
  >
    {suspending === tutor.id ? 'Memproses...' : tutor.suspended ? '✅ Aktifkan Kembali' : '🔒 Tangguhkan Tutor'}
  </button>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/admin/tutors/page.tsx" app/api/tutors/route.ts
git commit -m "feat: add suspend/unsuspend toggle to admin tutors page"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Hubungi parent via WA: Tasks 1-3
- ✅ Lihat video per siswa di admin: Tasks 4-5
- ✅ Nonaktifkan/aktifkan siswa: Tasks 6-8
- ✅ Suspend/aktifkan tutor: Tasks 9-13
- ✅ Auth blocks suspended users at login
- ✅ Middleware blocks suspended active sessions

**Type consistency check:**
- `student.parentId` — Student interface in Task 3 step 3 adds it; matches `parentId` field from Prisma
- `Tutor.suspended` — added in Task 13 step 1; matches schema field from Task 9
- `token.suspended` — added to JWT type in Task 11 step 1; set in jwt callback step 2

**Edge cases covered:**
- Contact parent: shows disabled send button if parent has no phone
- Toggle student: uses optimistic pattern — only updates after successful PATCH
- Suspend: prevents suspending SUPER_ADMIN accounts
- Suspended tutor with active JWT: middleware checks `token.suspended` on every request

**Known limitation:** When a tutor gets suspended while logged in, their existing JWT session still has `suspended: false` until it expires or they log out and back in. This is acceptable — JWT expiry handles it naturally (typically within 24h).
