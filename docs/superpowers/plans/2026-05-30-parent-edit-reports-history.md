# Parent Dashboard Enhancement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix parent data editing (admin + self-service), ensure parents clearly see tutor reports with inline videos, and add a daily learning history timeline page.

**Architecture:** Admin `ParentsClient` gets an edit modal wired to existing `PUT /api/users/[id]`. Parents get a new `/parent/profile` page + `/api/profile` endpoint for self-service edits. The `/parent/progress` page gets an inline HTML5 video player. `ParentScheduleList` gains media rendering. A new `/parent/history` Server Component page aggregates schedules + attendance + reports grouped by date.

**Tech Stack:** Next.js 14 App Router, Server Components, TypeScript, Prisma ORM, Tailwind CSS, NextAuth.js, bcryptjs, Zod

---

## Files Modified / Created

| Path | Action | Purpose |
|------|--------|---------|
| `app/(dashboard)/admin/parents/ParentsClient.tsx` | Modify | Add edit parent modal + button in actions column |
| `app/api/profile/route.ts` | Create | Authenticated user self-service PUT endpoint |
| `app/(dashboard)/parent/profile/page.tsx` | Create | Server Component wrapper for profile page |
| `app/(dashboard)/parent/profile/ProfileClient.tsx` | Create | Form client component for profile edit |
| `app/(dashboard)/parent/progress/page.tsx` | Modify | Inline HTML5 `<video>` player instead of emoji link |
| `components/dashboard/ParentScheduleList.tsx` | Modify | Add `media` to Report interface + render media |
| `app/(dashboard)/parent/schedule/page.tsx` | Modify | Include `media: true` in reports query |
| `app/(dashboard)/parent/history/page.tsx` | Create | Daily learning history timeline |
| `components/dashboard/sidebar.tsx` | Modify | Add Riwayat Belajar + Profil Saya to PARENT nav |

---

### Task 1: Admin Edit Parent Data

**Files:**
- Modify: `app/(dashboard)/admin/parents/ParentsClient.tsx`

The existing API `PUT /api/users/[id]` already works and is SUPER_ADMIN-only. The UI just needs an edit modal wired to it.

- [ ] **Step 1: Add `Pencil` to lucide-react import**

In `ParentsClient.tsx` line 1-23, find the lucide-react import and add `Pencil`:

```tsx
import {
  UsersRound,
  UserCheck,
  UserX,
  UserPlus,
  CreditCard,
  BarChart2,
  X,
  Calendar,
  Award,
  Info,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  BookOpen,
  Check,
  Pencil,
} from 'lucide-react'
```

- [ ] **Step 2: Add edit state variables**

After the `addSuccess` state declaration (around line 113), add:

```tsx
const [editingParent, setEditingParent] = useState<Parent | null>(null)
const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', password: '' })
const [editSaving, setEditSaving] = useState(false)
const [editError, setEditError] = useState<string | null>(null)
```

- [ ] **Step 3: Add `handleStartEdit` and `handleEditSave` functions**

After the `handleAddParent` function (after line ~157), add:

```tsx
const handleStartEdit = useCallback((parent: Parent) => {
  setEditingParent(parent)
  setEditForm({ name: parent.name, email: parent.email, phone: parent.phone || '', password: '' })
  setEditError(null)
}, [])

const handleEditSave = useCallback(async (e: React.FormEvent) => {
  e.preventDefault()
  if (!editingParent) return
  setEditSaving(true)
  setEditError(null)
  try {
    const body: any = {
      name: editForm.name,
      email: editForm.email,
      phone: editForm.phone || null,
    }
    if (editForm.password.trim().length >= 6) body.password = editForm.password

    const res = await fetch(`/api/users/${editingParent.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Gagal memperbarui data.')

    setParents((prev) =>
      prev.map((p) =>
        p.id === editingParent.id
          ? { ...p, name: data.name, email: data.email, phone: data.phone }
          : p
      )
    )
    if (selectedParent?.id === editingParent.id) {
      setSelectedParent((prev) => prev ? { ...prev, name: data.name, email: data.email, phone: data.phone } : null)
    }
    setEditingParent(null)
  } catch (err: any) {
    setEditError(err.message)
  } finally {
    setEditSaving(false)
  }
}, [editingParent, editForm, selectedParent])
```

- [ ] **Step 4: Add edit button to `account_status` column**

In the `account_status` column cell (around line 370), find the `<div className="flex items-center gap-2">` and add a button before the suspend button:

```tsx
<div className="flex items-center gap-2">
  <button
    onClick={() => handleStartEdit(parent)}
    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all border bg-slate-50 border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-indigo-950/20 dark:hover:text-indigo-400"
    title="Edit data wali murid"
  >
    <Pencil className="h-3 w-3" />
    Edit
  </button>
  {/* existing suspend button below unchanged */}
```

- [ ] **Step 5: Add edit modal JSX**

Find the main return statement's closing `</div>` at the bottom of the component. Before it, add the modal:

```tsx
{editingParent && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setEditingParent(null)} />
    <div className="relative w-full max-w-md bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800/60 rounded-3xl p-6 shadow-2xl z-10">
      <div className="absolute top-0 left-0 w-full h-[5px] bg-gradient-to-r from-indigo-500 to-violet-500 rounded-t-3xl" />
      <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800/60 mb-5">
        <div>
          <h3 className="text-base font-extrabold text-slate-800 dark:text-white">✏️ Edit Wali Murid</h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{editingParent.name}</p>
        </div>
        <button
          onClick={() => setEditingParent(null)}
          className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {editError && (
        <div className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{editError}</span>
        </div>
      )}

      <form onSubmit={handleEditSave} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
          <input
            type="text"
            value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            required
            className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 px-3.5 py-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
          <input
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
            required
            className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 px-3.5 py-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">No. HP / WhatsApp</label>
          <input
            type="text"
            value={editForm.phone}
            onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="08123456789"
            className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 px-3.5 py-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Password Baru <span className="text-slate-400 normal-case font-normal">(kosongkan jika tidak diubah)</span>
          </label>
          <input
            type="password"
            value={editForm.password}
            onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Min. 6 karakter"
            className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 px-3.5 py-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
          />
        </div>
        <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
          <button
            type="button"
            onClick={() => setEditingParent(null)}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={editSaving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-xs transition-all cursor-pointer"
          >
            {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```

- [ ] **Step 6: Add `handleStartEdit` to `useMemo` deps**

The `columns` useMemo (line ~417) has deps `[handleToggleSuspend, togglingId]`. Add `handleStartEdit`:

```tsx
], [handleToggleSuspend, togglingId, handleStartEdit])
```

- [ ] **Step 7: Verify edit works**

1. Run the dev server: `pnpm dev` or `npm run dev`
2. Log in as SUPER_ADMIN at `/admin/parents`
3. Find any parent row — confirm "Edit" button is visible next to the suspend button
4. Click Edit → modal opens with pre-filled name, email, phone
5. Change the phone number → Save
6. Verify table row updates without page reload
7. Re-open edit modal → verify new phone is pre-filled

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/admin/parents/ParentsClient.tsx"
git commit -m "feat(admin): add edit parent data modal"
```

---

### Task 2: Parent Self-Service Profile Edit

**Files:**
- Create: `app/api/profile/route.ts`
- Create: `app/(dashboard)/parent/profile/page.tsx`
- Create: `app/(dashboard)/parent/profile/ProfileClient.tsx`
- Modify: `components/dashboard/sidebar.tsx`

The existing `PUT /api/users/[id]` is SUPER_ADMIN only. Parents need their own endpoint that edits only their own account (no role or email changes).

- [ ] **Step 1: Create `app/api/profile/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const schema = z.object({
  name: z.string().min(1, 'Nama tidak boleh kosong'),
  phone: z.string().optional().nullable(),
  password: z.string().min(6).optional().nullable().or(z.literal('')),
})

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { name, phone, password } = parsed.data
  const updateData: any = { name, phone: phone || null }
  if (password && password.trim().length >= 6) {
    updateData.password = await bcrypt.hash(password, 12)
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true },
    })
    return NextResponse.json(user)
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui profil.' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Test the API (manual)**

With dev server running, log in as a PARENT. In browser console:

```javascript
fetch('/api/profile', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Test Nama', phone: '08123456789' })
}).then(r => r.json()).then(console.log)
```

Expected: `{ id: "...", name: "Test Nama", email: "...", phone: "08123456789" }`
Not expected: 401 or 500 error.

- [ ] **Step 3: Create `app/(dashboard)/parent/profile/ProfileClient.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface ProfileClientProps {
  user: { id: string; name: string; email: string; phone: string | null }
}

export default function ProfileClient({ user }: ProfileClientProps) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || '',
    password: '',
    confirmPassword: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (form.password && form.password !== form.confirmPassword) {
      setError('Konfirmasi password tidak cocok.')
      return
    }

    setSaving(true)
    try {
      const body: any = { name: form.name, phone: form.phone || null }
      if (form.password) body.password = form.password

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Gagal menyimpan.')

      setSuccess('Profil berhasil diperbarui!')
      setForm((f) => ({ ...f, password: '', confirmPassword: '' }))
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-violet-800 p-5 sm:p-8 text-white shadow-xl shadow-violet-600/10">
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">👤 Profil Saya</h1>
        <p className="mt-2 text-sm text-violet-100">Perbarui nama, nomor HP, atau password akun Anda.</p>
      </div>

      <div className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 p-6 shadow-xs">
        <div className="mb-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/40">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Email (tidak dapat diubah)</p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{user.email}</p>
        </div>

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 px-3.5 py-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">No. HP / WhatsApp</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="08123456789"
              className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 px-3.5 py-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Ubah Password (opsional)</p>
            <div className="space-y-3">
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Password baru (min. 6 karakter)"
                className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 px-3.5 py-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
              />
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Konfirmasi password baru"
                className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 px-3.5 py-2.5 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-semibold text-sm transition-all cursor-pointer shadow-md shadow-violet-500/20"
            >
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/(dashboard)/parent/profile/page.tsx`**

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import ProfileClient from './ProfileClient'

export default async function ParentProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true },
  })
  if (!user) redirect('/login')

  return <ProfileClient user={user} />
}
```

- [ ] **Step 5: Add sidebar links for PARENT**

In `components/dashboard/sidebar.tsx`, replace the `case 'PARENT':` block (lines 104-110):

```tsx
case 'PARENT':
  return [
    { name: 'Dashboard', href: '/parent', icon: LayoutDashboard },
    { name: 'Perkembangan', href: '/parent/progress', icon: TrendingUp },
    { name: 'Riwayat Belajar', href: '/parent/history', icon: BookOpen },
    { name: 'Jadwal', href: '/parent/schedule', icon: Calendar },
    { name: 'Tagihan', href: '/parent/billing', icon: CreditCard },
    { name: 'Profil Saya', href: '/parent/profile', icon: Settings },
  ]
```

`BookOpen` and `Settings` are already imported in the file (lines 17, 19).

- [ ] **Step 6: Verify profile page**

1. Log in as a PARENT
2. Sidebar should show "Riwayat Belajar" and "Profil Saya" links
3. Click "Profil Saya" → navigate to `/parent/profile`
4. Form shows current name, phone; email is read-only
5. Change phone number → save → green success toast appears
6. Reload page → new phone is still shown

- [ ] **Step 7: Commit**

```bash
git add app/api/profile/route.ts "app/(dashboard)/parent/profile/page.tsx" "app/(dashboard)/parent/profile/ProfileClient.tsx" components/dashboard/sidebar.tsx
git commit -m "feat(parent): self-service profile edit page and API endpoint"
```

---

### Task 3: Enhance Tutor Report + Video Display

**Files:**
- Modify: `app/(dashboard)/parent/progress/page.tsx`
- Modify: `components/dashboard/ParentScheduleList.tsx`
- Modify: `app/(dashboard)/parent/schedule/page.tsx`

Currently videos in `/parent/progress` are dead 🎥 emoji icons. `ParentScheduleList` shows report text in a toggle but never renders media. Parents miss videos entirely.

- [ ] **Step 1: Replace video emoji with inline player in progress page**

In `app/(dashboard)/parent/progress/page.tsx` (around line 86), find this block:

```tsx
) : (
  <div className="h-24 w-24 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center">
    <span className="text-2xl">🎥</span>
  </div>
)}
```

Replace with:

```tsx
) : (
  <video
    src={m.url}
    controls
    preload="metadata"
    className="h-24 w-24 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-pointer"
    title={m.filename}
  />
)}
```

- [ ] **Step 2: Add `Media` interface and `media` field to `Report` in `ParentScheduleList.tsx`**

In `components/dashboard/ParentScheduleList.tsx`, before the `Report` interface, add:

```tsx
interface Media {
  id: string
  url: string
  type: 'PHOTO' | 'VIDEO'
  filename: string
}
```

Then update the `Report` interface to add `media`:

```tsx
interface Report {
  id: string
  studentId: string
  content: string
  score: number | null
  createdAt: string
  tutor: { name: string }
  student: { id: string; name: string }
  media: Media[]
}
```

- [ ] **Step 3: Render media inside the expanded report view**

In `ParentScheduleList.tsx`, find the report card inside the `{expandedReport === s.id && ...}` block (around line 221). After the score line, add:

```tsx
{report.score !== null && (
  <p className="font-semibold text-indigo-600 dark:text-indigo-400">Nilai: {report.score}/100</p>
)}
{report.media && report.media.length > 0 && (
  <div className="flex flex-wrap gap-2 mt-2">
    {report.media.map((m) => (
      <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="block shrink-0">
        {m.type === 'PHOTO' ? (
          <img
            src={m.url}
            alt={m.filename}
            className="h-16 w-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
          />
        ) : (
          <div className="h-16 w-16 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 flex flex-col items-center justify-center gap-0.5">
            <span className="text-xl">🎥</span>
            <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">VIDEO</span>
          </div>
        )}
      </a>
    ))}
  </div>
)}
```

- [ ] **Step 4: Include media in the schedule page reports query**

In `app/(dashboard)/parent/schedule/page.tsx` (lines 31-38), find:

```tsx
reports: {
  where: { student: { parentId: userId } },
  include: {
    tutor: { select: { name: true } },
    student: { select: { id: true, name: true } },
  },
},
```

Add `media: true`:

```tsx
reports: {
  where: { student: { parentId: userId } },
  include: {
    tutor: { select: { name: true } },
    student: { select: { id: true, name: true } },
    media: true,
  },
},
```

- [ ] **Step 5: Verify media display**

1. Go to `/parent/progress` as a PARENT
2. Find a report with video media → confirm inline `<video>` player renders (not just emoji)
3. Click play → video plays inline in the card
4. Go to `/parent/schedule`
5. Find a past schedule with a tutor report → click "Lihat Laporan Belajar"
6. Photos show as thumbnails, video shows as 🎥 tile with link to open

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/parent/progress/page.tsx" components/dashboard/ParentScheduleList.tsx "app/(dashboard)/parent/schedule/page.tsx"
git commit -m "feat(parent): inline video player in progress page, show media in schedule reports"
```

---

### Task 4: Daily Learning History Page

**Files:**
- Create: `app/(dashboard)/parent/history/page.tsx`

(Sidebar was already updated in Task 2 Step 5.)

The history page shows all past schedules grouped by date, each with per-student attendance + report + media. Think of it as a journal: every day of class, what happened.

- [ ] **Step 1: Create `app/(dashboard)/parent/history/page.tsx`**

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

function formatDate(date: Date) {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getAttendanceBadge(status: string | undefined) {
  const map: Record<string, { label: string; classes: string }> = {
    PRESENT: { label: 'Hadir', classes: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20' },
    ABSENT: { label: 'Alpha', classes: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20' },
    SICK: { label: 'Sakit', classes: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20' },
    PERMISSION: { label: 'Izin', classes: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20' },
  }
  return (
    map[status ?? ''] ?? {
      label: 'Belum Tercatat',
      classes: 'bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800/40',
    }
  )
}

export default async function ParentHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const { studentId } = await searchParams

  const children = await prisma.student.findMany({
    where: { parentId: userId },
    select: { id: true, name: true },
  })

  const studentFilter = studentId ? { id: studentId } : {}

  const schedules = await prisma.schedule.findMany({
    where: {
      status: { in: ['COMPLETED', 'PUBLISHED'] },
      date: { lte: new Date() },
      class: {
        enrollments: {
          some: { student: { parentId: userId, ...studentFilter } },
        },
      },
    },
    include: {
      class: {
        select: {
          name: true,
          tutor: { select: { name: true } },
          enrollments: {
            where: { student: { parentId: userId, ...studentFilter } },
            include: { student: { select: { id: true, name: true } } },
          },
        },
      },
      attendances: {
        where: { student: { parentId: userId, ...studentFilter } },
        include: { student: { select: { id: true, name: true } } },
      },
      reports: {
        where: { student: { parentId: userId, ...studentFilter } },
        include: {
          tutor: { select: { name: true } },
          student: { select: { id: true, name: true } },
          media: true,
        },
      },
    },
    orderBy: { date: 'desc' },
  })

  // Group by calendar date
  const grouped = new Map<string, typeof schedules>()
  for (const s of schedules) {
    const key = new Date(s.date).toDateString()
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(s)
  }
  const groupedEntries = Array.from(grouped.entries())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">📖 Riwayat Belajar Harian</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Rekam jejak kehadiran, materi, dan laporan tutor setiap harinya.
        </p>
      </div>

      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <a
            href="/parent/history"
            className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
              !studentId
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-500/40'
            }`}
          >
            Semua Anak
          </a>
          {children.map((c) => (
            <a
              key={c.id}
              href={`/parent/history?studentId=${c.id}`}
              className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
                studentId === c.id
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-500/40'
              }`}
            >
              {c.name}
            </a>
          ))}
        </div>
      )}

      {groupedEntries.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 p-10 text-center text-slate-400 dark:text-slate-500">
          <p className="text-3xl">📭</p>
          <p className="mt-2 text-sm font-medium">Belum ada riwayat belajar.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline spine */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-violet-300 via-slate-200 to-transparent dark:from-violet-500/40 dark:via-slate-800/60 dark:to-transparent hidden sm:block" />

          <div className="space-y-8">
            {groupedEntries.map(([dateKey, daySchedules]) => {
              const date = new Date(dateKey)
              const isToday = dateKey === new Date().toDateString()

              return (
                <div key={dateKey} className="sm:pl-14 relative">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-0 top-1 h-8 w-8 rounded-full border-2 hidden sm:flex items-center justify-center text-xs font-bold select-none ${
                      isToday
                        ? 'bg-violet-600 border-violet-600 text-white'
                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {date.getDate()}
                  </div>

                  <div className="mb-3">
                    <h2 className={`text-sm font-extrabold ${isToday ? 'text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400'}`}>
                      {isToday && '📍 Hari Ini — '}{formatDate(date)}
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {daySchedules.map((sched) => (
                      <div key={sched.id} className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 shadow-xs p-5 space-y-4">
                        {/* Class header */}
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">{sched.class.name}</h3>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              Tutor: {sched.class.tutor.name} · {sched.startTime}–{sched.endTime} WIB
                            </p>
                          </div>
                          {sched.topic && (
                            <span className="text-xs bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 font-semibold px-2.5 py-1 rounded-lg border border-violet-100 dark:border-violet-500/20 shrink-0">
                              📚 {sched.topic}
                            </span>
                          )}
                        </div>

                        {/* Per-student rows */}
                        {sched.class.enrollments.map(({ student }) => {
                          const att = sched.attendances.find((a) => a.studentId === student.id)
                          const report = sched.reports.find((r) => r.studentId === student.id)
                          const badge = getAttendanceBadge(att?.status)

                          return (
                            <div
                              key={student.id}
                              className="rounded-xl bg-slate-50/60 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/40 p-4 space-y-3"
                            >
                              {/* Student + attendance */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center text-xs font-bold text-violet-700 dark:text-violet-400">
                                    {student.name.substring(0, 2).toUpperCase()}
                                  </div>
                                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{student.name}</span>
                                </div>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${badge.classes}`}>
                                  {badge.label}
                                </span>
                              </div>

                              {/* Report or placeholder */}
                              {report ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                      Laporan Tutor
                                    </p>
                                    {report.score !== null && (
                                      <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center">
                                        <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                                          {report.score}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                                    {report.content}
                                  </p>
                                  {report.media.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {report.media.map((m) =>
                                        m.type === 'PHOTO' ? (
                                          <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">
                                            <img
                                              src={m.url}
                                              alt={m.filename}
                                              className="h-16 w-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                                            />
                                          </a>
                                        ) : (
                                          <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">
                                            <video
                                              src={m.url}
                                              preload="metadata"
                                              className="h-16 w-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700 cursor-pointer"
                                              title={m.filename}
                                            />
                                          </a>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                                  {att?.status === 'ABSENT' || att?.status === 'SICK' || att?.status === 'PERMISSION'
                                    ? 'Tidak hadir — laporan tidak diperlukan.'
                                    : 'Laporan belum tersedia.'}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify history page**

1. Log in as a PARENT
2. Click "Riwayat Belajar" in sidebar → opens `/parent/history`
3. Dates appear in descending order (newest at top)
4. Each date shows a card per class with: tutor name, time, topic badge
5. Each student row shows attendance badge (Hadir/Sakit/Izin/Alpha)
6. Rows with reports show the report text and score
7. Media (photos/videos) render as thumbnails
8. If multiple children: filter tabs at top work correctly
9. Timeline spine and dots visible on desktop

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/parent/history/page.tsx"
git commit -m "feat(parent): add daily learning history timeline page"
```

---

## Self-Review

### Spec Coverage

| Requirement | Covered by |
|-------------|-----------|
| Admin edit parent data | Task 1 — edit modal in ParentsClient |
| Parent edit own data | Task 2 — `/parent/profile` + `/api/profile` |
| Parent sees tutor reports | Already existed at `/parent/progress`; Task 3 enhances it |
| Parent sees videos | Task 3 — inline `<video>` in progress page + media in schedule list |
| Daily learning history | Task 4 — `/parent/history` timeline |
| Sidebar navigation | Task 2 Step 5 adds both Riwayat + Profil links |

### Potential Pitfalls

1. **`handleEditSave` deps**: Ensure `handleStartEdit` is added to the `columns` `useMemo` dependency array or it will use a stale closure.
2. **`useMemo` for `handleStartEdit`**: Wrap in `useCallback` (already shown) so it's stable across renders.
3. **History page `searchParams` async**: The `searchParams` is typed as `Promise<...>` — remember to `await` it (already shown in code).
4. **Media in schedule**: The `reports` data passed to `ParentScheduleList` now includes `media`, but the TypeScript type must match. If `media` is optional in the Prisma query result, add `media?: Media[]` to the interface as a fallback — but since `media: true` is explicit in the query, it will always be present.
