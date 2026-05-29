# Complete Menus, WAHA & n8n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all broken/missing admin UI features, wire up WAHA session management panel, and provide n8n workflow integration setup in the admin dashboard.

**Architecture:** Six independent tasks targeting specific file changes. Each task is self-contained — no task depends on another completing first except Task 5 (edit classes) which assumes Task 4's enrollment API exists.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, NextAuth, bcryptjs, TypeScript, Tailwind CSS, WAHA (WhatsApp HTTP API), n8n workflow automation.

---

## Audit: What's Already Working

Before implementing, understand current state:

| Feature | Status | Gap |
|---|---|---|
| Admin Dashboard stats | ✅ Complete | — |
| Admin Students CRUD | ⚠️ Broken UX | `parentId` is raw UUID text input |
| Admin Tutors read | ⚠️ Wrong source | Uses `/api/classes` hack, not `/api/tutors` |
| Admin Classes create | ⚠️ Partial | Edit button has no handler |
| Admin Schedules create+publish | ✅ Complete | WAHA broadcast + n8n trigger wired |
| Admin Billing create | ⚠️ Broken UX | `studentId` is raw UUID text input |
| Admin Announcements CRUD | ✅ Complete | — |
| Parent Dashboard | ✅ Complete | — |
| Parent Schedule + excuse | ✅ Complete | `/api/schedules/[id]/excuse` exists |
| Parent Billing + Midtrans | ✅ Complete | — |
| Parent Progress reports | ✅ Complete | — |
| Tutor Dashboard + attendance + reports | ✅ Complete | Accessible via schedule card links |
| WAHA docker service | ✅ Configured | Session needs QR scan (no admin UI) |
| WAHA direct broadcast | ✅ Wired | Called on schedule publish |
| n8n docker service | ✅ Configured | Workflow JSON not yet imported |
| n8n trigger | ✅ Wired | Called on schedule publish |
| Enrollment create API | ✅ Exists | No UI to enroll students |
| Enrollment delete API | ❌ Missing | — |
| User creation API | ❌ Missing | Can't create tutors/parents via UI |
| Admin Settings page | ❌ Missing | No WAHA/n8n status panel |

---

## File Map

**New files to create:**
- `app/api/users/route.ts` — GET list users by role, POST create user account
- `app/api/enrollments/[id]/route.ts` — DELETE enrollment (unenroll student)
- `app/api/admin/status/route.ts` — GET WAHA session status + n8n ping
- `app/(dashboard)/admin/settings/page.tsx` — WAHA + n8n integration panel

**Files to modify:**
- `app/(dashboard)/admin/students/page.tsx` — Fix `parentId` to use dropdown
- `app/(dashboard)/admin/billing/page.tsx` — Fix `studentId` to use dropdown
- `app/(dashboard)/admin/classes/page.tsx` — Wire edit modal, add enrollment management
- `app/(dashboard)/admin/tutors/page.tsx` — Use `/api/tutors`, add create tutor form
- `components/dashboard/sidebar.tsx` — Add "Pengaturan" item to admin nav

---

## Task 1: Create `/api/users` — List + Create User Accounts

**Files:**
- Create: `app/api/users/route.ts`

- [ ] **Step 1: Write the route file**

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  role: z.enum([Role.TUTOR, Role.PARENT]),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const role = req.nextUrl.searchParams.get('role') as Role | null
  const where = role ? { role } : {}

  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, email, password, phone, role } = parsed.data
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Email sudah digunakan.' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { name, email, password: hashed, phone, role },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
  })
  return NextResponse.json(user, { status: 201 })
}
```

- [ ] **Step 2: Verify the file saved correctly**

Read `app/api/users/route.ts` and confirm both GET and POST handlers are present.

- [ ] **Step 3: Commit**

```bash
git add app/api/users/route.ts
git commit -m "feat: add GET/POST /api/users for admin user management"
```

---

## Task 2: Create `DELETE /api/enrollments/[id]` — Unenroll Student

**Files:**
- Create: `app/api/enrollments/[id]/route.ts`

- [ ] **Step 1: Write the route file**

```typescript
// app/api/enrollments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  await prisma.enrollment.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/enrollments/[id]/route.ts
git commit -m "feat: add DELETE /api/enrollments/[id] to unenroll students"
```

---

## Task 3: Create `GET /api/admin/status` — WAHA + n8n Status

**Files:**
- Create: `app/api/admin/status/route.ts`

- [ ] **Step 1: Write the route file**

```typescript
// app/api/admin/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSessionStatus } from '@/lib/waha'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check WAHA session
  const wahaStatus = await getSessionStatus()

  // Check n8n (simple ping to healthcheck)
  let n8nStatus = 'OFFLINE'
  try {
    const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace('/webhook', '') ?? 'http://localhost:5678'
    const res = await fetch(`${n8nUrl}/healthz`, { signal: AbortSignal.timeout(3000) })
    n8nStatus = res.ok ? 'ONLINE' : 'ERROR'
  } catch {
    n8nStatus = 'OFFLINE'
  }

  return NextResponse.json({
    waha: {
      status: wahaStatus,
      dashboardUrl: process.env.WAHA_BASE_URL ?? 'http://localhost:3001',
      session: process.env.WAHA_SESSION ?? 'default',
    },
    n8n: {
      status: n8nStatus,
      dashboardUrl: (process.env.N8N_WEBHOOK_BASE_URL ?? 'http://localhost:5678/webhook').replace('/webhook', ''),
      workflowFile: 'docs/n8n-schedule-workflow.json',
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/status/route.ts
git commit -m "feat: add GET /api/admin/status for WAHA + n8n health check"
```

---

## Task 4: Fix Admin Students — Parent Dropdown

**Files:**
- Modify: `app/(dashboard)/admin/students/page.tsx`

Currently the `parentId` field is a raw text input. Replace with a dropdown that fetches from `GET /api/users?role=PARENT`.

- [ ] **Step 1: Add state for parents and fetch them**

In `app/(dashboard)/admin/students/page.tsx`, after the existing `students` state declarations, add:

```typescript
const [parents, setParents] = useState<{ id: string; name: string; email: string }[]>([])
```

Add `fetchParents` callback after `fetchStudents`:

```typescript
const fetchParents = useCallback(async () => {
  try {
    const res = await fetch('/api/users?role=PARENT')
    setParents(await res.json())
  } catch {
    console.error('Gagal memuat data orang tua.')
  }
}, [])
```

Update the `useEffect` to also call `fetchParents()`:

```typescript
useEffect(() => { fetchStudents(); fetchParents() }, [fetchStudents, fetchParents])
```

- [ ] **Step 2: Replace the parentId text input with a select dropdown**

Find this block in the form (inside the `!editId` guard):

```tsx
{!editId && (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1">ID Orang Tua *</label>
    <input
      required
      value={form.parentId}
      onChange={(e) => setForm({ ...form, parentId: e.target.value })}
      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
      placeholder="User ID orang tua"
    />
  </div>
)}
```

Replace with:

```tsx
{!editId && (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1">Orang Tua *</label>
    <select
      required
      value={form.parentId}
      onChange={(e) => setForm({ ...form, parentId: e.target.value })}
      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
    >
      <option value="">Pilih Orang Tua</option>
      {parents.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.email})
        </option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/admin/students/page.tsx
git commit -m "fix: replace parentId text input with parent dropdown in admin students form"
```

---

## Task 5: Fix Admin Billing — Student Dropdown

**Files:**
- Modify: `app/(dashboard)/admin/billing/page.tsx`

Currently the `studentId` field is a raw text input. Replace with a dropdown fetching from `/api/students`.

- [ ] **Step 1: Add state for students and fetch them**

In `app/(dashboard)/admin/billing/page.tsx`, add state after existing state declarations:

```typescript
const [students, setStudents] = useState<{ id: string; name: string; grade: string | null }[]>([])
```

Add `fetchStudentList` callback:

```typescript
const fetchStudentList = useCallback(async () => {
  try {
    const res = await fetch('/api/students')
    setStudents(await res.json())
  } catch {
    console.error('Gagal memuat daftar siswa.')
  }
}, [])
```

Update `useEffect`:

```typescript
useEffect(() => { fetchInvoices(); fetchStudentList() }, [fetchInvoices, fetchStudentList])
```

- [ ] **Step 2: Replace the studentId text input with a select dropdown**

Find and replace the `studentId` field inside the form. The current code renders form fields via `.map(...)` using an array. The `studentId` field is defined as `{ label: 'ID Siswa *', key: 'studentId', type: 'text', placeholder: 'Student ID' }`.

Replace the entire form's field array rendering with explicit per-field JSX:

```tsx
<form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1">Siswa *</label>
    <select
      required
      value={form.studentId}
      onChange={(e) => setForm({ ...form, studentId: e.target.value })}
      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
    >
      <option value="">Pilih Siswa</option>
      {students.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}{s.grade ? ` (${s.grade})` : ''}
        </option>
      ))}
    </select>
  </div>
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1">Nominal (Rp) *</label>
    <input
      required
      type="number"
      value={form.amount}
      onChange={(e) => setForm({ ...form, amount: e.target.value })}
      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
      placeholder="500000"
    />
  </div>
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1">Keterangan *</label>
    <input
      required
      type="text"
      value={form.description}
      onChange={(e) => setForm({ ...form, description: e.target.value })}
      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
      placeholder="mis. Biaya Bimbel Bulan Juni"
    />
  </div>
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1">Jatuh Tempo *</label>
    <input
      required
      type="date"
      value={form.dueDate}
      onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
    />
  </div>
  <div className="sm:col-span-2 flex gap-3">
    <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
      {saving ? 'Menyimpan...' : 'Buat Invoice'}
    </button>
    <button type="button" onClick={() => setShowForm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">Batal</button>
  </div>
</form>
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/admin/billing/page.tsx
git commit -m "fix: replace studentId text input with student dropdown in billing form"
```

---

## Task 6: Fix Admin Classes — Edit Modal + Enrollment Management

**Files:**
- Modify: `app/(dashboard)/admin/classes/page.tsx`

Two sub-features:
1. Wire the Pencil edit button to an edit modal
2. Add "Kelola Siswa" button per class to manage enrollments

- [ ] **Step 1: Extend the Class interface to include enrollments + id for edit**

The existing `Class` interface already has `id`. We need enrollments for the management modal. Update the interface:

```typescript
interface Class {
  id: string
  name: string
  subject: string
  description: string | null
  tutor: { name: string; email: string }
  _count: { enrollments: number }
  enrollments?: Array<{ id: string; student: { id: string; name: string; grade: string | null } }>
}
```

Update `fetchClasses` to include enrollments:

```typescript
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
```

The `/api/classes` GET route needs to include enrollments. Check `app/api/classes/route.ts` — if it doesn't include enrollments, update the Prisma query there to add `enrollments: { include: { student: { select: { id: true, name: true, grade: true } } } }`.

- [ ] **Step 2: Add edit + enrollment state variables**

After existing state declarations, add:

```typescript
const [editClass, setEditClass] = useState<Class | null>(null)
const [showEditForm, setShowEditForm] = useState(false)
const [editForm, setEditForm] = useState({ name: '', subject: '', description: '', tutorId: '' })
const [editSaving, setEditSaving] = useState(false)

const [enrollClass, setEnrollClass] = useState<Class | null>(null)
const [enrollStudentId, setEnrollStudentId] = useState('')
const [enrollSaving, setEnrollSaving] = useState(false)
const [allStudents, setAllStudents] = useState<{ id: string; name: string; grade: string | null }[]>([])
```

Add `fetchAllStudents` callback:

```typescript
const fetchAllStudents = useCallback(async () => {
  try {
    const res = await fetch('/api/students')
    setAllStudents(await res.json())
  } catch {}
}, [])
```

Update useEffect to call `fetchAllStudents()` as well.

- [ ] **Step 3: Add handleEditSubmit and handleEnrollSubmit and handleUnenroll handlers**

```typescript
const handleEditSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!editClass) return
  setEditSaving(true)
  setError(null)
  try {
    const res = await fetch(`/api/classes/${editClass.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
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
    await fetchClasses()
    setEnrollStudentId('')
    // Refresh enrollClass data from updated classes list
    const updated = await fetch('/api/classes')
    const list = await updated.json()
    const refreshed = list.find((c: Class) => c.id === enrollClass.id)
    if (refreshed) setEnrollClass(refreshed)
  } catch (err: any) {
    setError(err.message)
  } finally {
    setEnrollSaving(false)
  }
}

const handleUnenroll = async (enrollmentId: string) => {
  if (!confirm('Keluarkan siswa dari kelas ini?')) return
  try {
    await fetch(`/api/enrollments/${enrollmentId}`, { method: 'DELETE' })
    await fetchClasses()
    if (enrollClass) {
      const updated = await fetch('/api/classes')
      const list = await updated.json()
      const refreshed = list.find((c: Class) => c.id === enrollClass.id)
      if (refreshed) setEnrollClass(refreshed)
    }
  } catch {
    setError('Gagal mengeluarkan siswa.')
  }
}
```

- [ ] **Step 4: Wire the edit button in each class card**

Find the Pencil button (currently has no `onClick`):

```tsx
<button className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer">
  <Pencil className="h-4 w-4" />
</button>
```

Replace with:

```tsx
<button
  onClick={() => {
    setEditClass(cls)
    setEditForm({ name: cls.name, subject: cls.subject, description: cls.description || '', tutorId: '' })
    setShowEditForm(true)
  }}
  className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
>
  <Pencil className="h-4 w-4" />
</button>
```

Also add a "Kelola Siswa" button next to the student count section in each card:

```tsx
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
```

- [ ] **Step 5: Add the Edit Modal JSX**

After the existing class cards grid, add the edit form modal:

```tsx
{showEditForm && editClass && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => setShowEditForm(false)} />
    <div className="relative w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl z-10">
      <h2 className="font-bold text-slate-800 mb-4">Edit Kelas: {editClass.name}</h2>
      <form onSubmit={handleEditSubmit} className="grid sm:grid-cols-2 gap-4">
        {[
          { label: 'Nama Kelas *', key: 'name', placeholder: 'mis. Matematika Dasar' },
          { label: 'Mata Pelajaran *', key: 'subject', placeholder: 'mis. Matematika' },
          { label: 'Deskripsi', key: 'description', placeholder: 'Deskripsi singkat kelas' },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
            <input
              required={label.includes('*')}
              value={(editForm as any)[key]}
              onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              placeholder={placeholder}
            />
          </div>
        ))}
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
        <div className="sm:col-span-2 flex gap-3">
          <button type="submit" disabled={editSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
            {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
          <button type="button" onClick={() => setShowEditForm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">Batal</button>
        </div>
      </form>
    </div>
  </div>
)}
```

- [ ] **Step 6: Add the Enrollment Management Modal JSX**

After the edit modal, add enrollment modal:

```tsx
{enrollClass && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => setEnrollClass(null)} />
    <div className="relative w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl z-10 max-h-[80vh] overflow-y-auto">
      <h2 className="font-bold text-slate-800 mb-1">Kelola Siswa: {enrollClass.name}</h2>
      <p className="text-xs text-slate-500 mb-4">{enrollClass._count.enrollments} siswa terdaftar</p>

      {/* Enrolled Students List */}
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

      {/* Add Student */}
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
```

- [ ] **Step 7: Update `/api/classes` GET to include enrollments**

Read `app/api/classes/route.ts`. Find the `prisma.class.findMany` call and add enrollment include:

```typescript
const classes = await prisma.class.findMany({
  include: {
    tutor: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
    _count: { select: { enrollments: true } },
    enrollments: {
      include: {
        student: { select: { id: true, name: true, grade: true } },
      },
    },
  },
  orderBy: { name: 'asc' },
})
```

- [ ] **Step 8: Commit**

```bash
git add app/(dashboard)/admin/classes/page.tsx app/api/classes/route.ts
git commit -m "feat: add class edit modal and enrollment management to admin classes page"
```

---

## Task 7: Fix Admin Tutors — Use `/api/tutors` + Add Create Tutor Form

**Files:**
- Modify: `app/(dashboard)/admin/tutors/page.tsx`

Currently the page derives tutors from `/api/classes` by grouping — this misses tutors with no classes. Replace with the correct `/api/tutors` endpoint. Also add a "Tambah Tutor" form.

- [ ] **Step 1: Rewrite the tutors page**

Replace the entire file content with:

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Plus } from 'lucide-react'

interface Tutor {
  id: string
  name: string
  email: string
  phone: string | null
  createdAt: string
}

export default function AdminTutorsPage() {
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTutors = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tutors')
      setTutors(await res.json())
    } catch {
      setError('Gagal memuat data tutor.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTutors() }, [fetchTutors])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role: 'TUTOR' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal menambahkan tutor.')
      }
      await fetchTutors()
      setShowForm(false)
      setForm({ name: '', email: '', password: '', phone: '' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">👩‍🏫 Data Tutor</h1>
          <p className="text-sm text-slate-500 mt-0.5">Daftar tutor yang terdaftar di Mellyna Education.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Tambah Tutor
        </button>
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">⚠️ {error}</div>}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6">
          <h2 className="font-bold text-slate-800 mb-4">Tambah Tutor Baru</h2>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500" placeholder="mis. Pak Budi Santoso" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500" placeholder="tutor@email.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Password *</label>
              <input required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500" placeholder="Min. 6 karakter" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">No. HP (WhatsApp)</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500" placeholder="mis. 6281234567890" />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Tambah Tutor'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">Batal</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" /></div>
      ) : tutors.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
          <p className="text-3xl">👩‍🏫</p>
          <p className="mt-2 text-sm font-medium">Belum ada tutor yang terdaftar.</p>
          <p className="text-xs text-slate-400 mt-1">Klik "Tambah Tutor" untuk mendaftarkan tutor baru.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tutors.map((tutor) => (
            <div key={tutor.id} className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
                  <span className="text-xl">👩‍🏫</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{tutor.name}</h3>
                  <p className="text-xs text-slate-500">{tutor.email}</p>
                  {tutor.phone && <p className="text-xs text-slate-400">{tutor.phone}</p>}
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Terdaftar: {new Date(tutor.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
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
git add app/(dashboard)/admin/tutors/page.tsx
git commit -m "feat: refactor tutors page to use /api/tutors and add create tutor form"
```

---

## Task 8: Add Admin Settings Page — WAHA + n8n Integration Panel

**Files:**
- Create: `app/(dashboard)/admin/settings/page.tsx`
- Modify: `components/dashboard/sidebar.tsx`

- [ ] **Step 1: Create the settings page**

```tsx
// app/(dashboard)/admin/settings/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, RefreshCw, Wifi, WifiOff } from 'lucide-react'

interface IntegrationStatus {
  waha: {
    status: string
    dashboardUrl: string
    session: string
  }
  n8n: {
    status: string
    dashboardUrl: string
    workflowFile: string
  }
}

const StatusBadge = ({ status }: { status: string }) => {
  const isOnline = status === 'WORKING' || status === 'ONLINE'
  const isOff = status === 'OFFLINE' || status === 'STOPPED'
  const color = isOnline
    ? 'bg-emerald-100 text-emerald-700'
    : isOff
    ? 'bg-rose-100 text-rose-700'
    : 'bg-amber-100 text-amber-700'
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${color}`}>
      {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {status}
    </span>
  )
}

export default function AdminSettingsPage() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/status')
      if (res.ok) setStatus(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStatus() }, [])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">⚙️ Pengaturan & Integrasi</h1>
          <p className="text-sm text-slate-500 mt-0.5">Status koneksi WAHA (WhatsApp) dan n8n Automation.</p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* WAHA Section */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-extrabold text-slate-800">📱 WAHA — WhatsApp HTTP API</h2>
            <p className="text-xs text-slate-500 mt-1">Layanan notifikasi WhatsApp otomatis ke orang tua siswa.</p>
          </div>
          {status && <StatusBadge status={status.waha.status} />}
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cara Setup Sesi WhatsApp</p>
          <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside">
            <li>Jalankan <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">docker compose up -d waha</code></li>
            <li>Buka dashboard WAHA di tombol di bawah</li>
            <li>Login dengan username <strong>admin</strong> dan password <strong>mellyna-waha-secret</strong></li>
            <li>Klik sesi <strong>{status?.waha.session ?? 'default'}</strong> → Start → Scan QR code dengan WhatsApp</li>
            <li>Status akan berubah menjadi <strong>WORKING</strong> setelah QR berhasil di-scan</li>
          </ol>
        </div>

        {status && (
          <a
            href={status.waha.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Buka Dashboard WAHA
          </a>
        )}
      </div>

      {/* n8n Section */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-extrabold text-slate-800">⚡ n8n — Workflow Automation</h2>
            <p className="text-xs text-slate-500 mt-1">Workflow notifikasi jadwal cadangan via n8n → WAHA.</p>
          </div>
          {status && <StatusBadge status={status.n8n.status} />}
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cara Import Workflow n8n</p>
          <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside">
            <li>Jalankan <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">docker compose up -d n8n</code></li>
            <li>Buka dashboard n8n di tombol di bawah (login: admin / adminpassword)</li>
            <li>Klik <strong>Workflows</strong> → <strong>Import from File</strong></li>
            <li>Upload file <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">docs/n8n-schedule-workflow.json</code></li>
            <li>Buka workflow → klik <strong>Active</strong> toggle (atas kanan) untuk mengaktifkan</li>
            <li>Pastikan env <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">N8N_WEBHOOK_BASE_URL</code> mengarah ke n8n yang berjalan</li>
          </ol>

          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700">
            <strong>Catatan:</strong> n8n adalah fallback — jadwal sudah ter-broadcast langsung via WAHA saat diterbitkan. n8n digunakan untuk workflow tambahan atau retry otomatis.
          </div>
        </div>

        {status && (
          <a
            href={status.n8n.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Buka Dashboard n8n
          </a>
        )}
      </div>

      {/* Env Variables Reference */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-3">
        <h2 className="font-extrabold text-slate-800">📋 Referensi Environment Variables</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 pr-4 font-semibold text-slate-500">Variable</th>
                <th className="text-left py-2 font-semibold text-slate-500">Fungsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-600">
              {[
                ['WAHA_BASE_URL', 'URL WAHA service (default: http://localhost:3001)'],
                ['WAHA_API_KEY', 'API key WAHA — harus cocok dengan WHATSAPP_API_KEY di docker-compose'],
                ['WAHA_SESSION', 'Nama sesi WhatsApp (default: default)'],
                ['N8N_WEBHOOK_BASE_URL', 'Base URL webhook n8n (default: http://localhost:5678/webhook)'],
                ['N8N_WEBHOOK_SECRET', 'Secret untuk autentikasi internal endpoint ke n8n'],
              ].map(([key, desc]) => (
                <tr key={key}>
                  <td className="py-2 pr-4 font-mono bg-slate-50 rounded px-2">{key}</td>
                  <td className="py-2 text-slate-500">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add "Pengaturan" to admin sidebar**

In `components/dashboard/sidebar.tsx`, find the `SUPER_ADMIN` case in `getNavLinks()`:

```typescript
case 'SUPER_ADMIN':
  return [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Siswa', href: '/admin/students', icon: GraduationCap },
    { name: 'Tutor', href: '/admin/tutors', icon: Users },
    { name: 'Kelas', href: '/admin/classes', icon: BookOpen },
    { name: 'Jadwal', href: '/admin/schedules', icon: Calendar },
    { name: 'Tagihan', href: '/admin/billing', icon: CreditCard },
    { name: 'Pengumuman', href: '/admin/announcements', icon: Megaphone },
  ]
```

Replace with (add Settings item and import `Settings` icon):

```typescript
case 'SUPER_ADMIN':
  return [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Siswa', href: '/admin/students', icon: GraduationCap },
    { name: 'Tutor', href: '/admin/tutors', icon: Users },
    { name: 'Kelas', href: '/admin/classes', icon: BookOpen },
    { name: 'Jadwal', href: '/admin/schedules', icon: Calendar },
    { name: 'Tagihan', href: '/admin/billing', icon: CreditCard },
    { name: 'Pengumuman', href: '/admin/announcements', icon: Megaphone },
    { name: 'Pengaturan', href: '/admin/settings', icon: Settings },
  ]
```

Also add `Settings` to the import from `lucide-react` at the top of the file:

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
} from 'lucide-react'
```

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/admin/settings/page.tsx app/api/admin/status/route.ts components/dashboard/sidebar.tsx
git commit -m "feat: add admin settings page with WAHA + n8n integration status panel"
```

---

## Self-Review Checklist

After all tasks complete, verify:

- [ ] Admin billing form shows student dropdown (not raw UUID input)
- [ ] Admin students form shows parent dropdown (not raw UUID input) 
- [ ] Admin classes pencil button opens edit modal with pre-filled data
- [ ] Admin classes "Kelola Siswa" opens enrollment modal with enroll/unenroll
- [ ] Admin tutors page shows all tutors (including those without classes)
- [ ] Admin tutors "Tambah Tutor" form creates account via `/api/users`
- [ ] Admin sidebar has "Pengaturan" item linking to `/admin/settings`
- [ ] Settings page loads WAHA status from `/api/admin/status`
- [ ] Settings page shows n8n status and import instructions
- [ ] All new API routes return 401 when unauthenticated
- [ ] All new API routes return 403 for non-SUPER_ADMIN roles

---

## Post-Implementation: Manual Steps

These require human action after code is deployed:

**WAHA Activation:**
1. `docker compose up -d waha`
2. Open `http://localhost:3001` (admin dashboard)
3. Login: admin / mellyna-waha-secret
4. Start session `default` → scan QR with WhatsApp
5. Verify status shows WORKING in Admin Settings page

**n8n Workflow Import:**
1. `docker compose up -d n8n`
2. Open `http://localhost:5678` (login: admin / adminpassword)
3. Workflows → Import from File → upload `docs/n8n-schedule-workflow.json`
4. Open workflow → toggle Active = ON
5. Verify webhook URL is `http://localhost:5678/webhook/schedule-published`
