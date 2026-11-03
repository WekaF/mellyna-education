# Super Admin User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah menu "Manajemen Akun" (khusus SUPER_ADMIN) untuk lihat semua user lintas role + edit, ganti password, tangguhkan, dan hapus user — sekaligus tutup celah ADMIN bisa mengubah/menghapus akun ADMIN/SUPER_ADMIN.

**Architecture:** API sudah ada (`PUT/DELETE /api/users/[id]`, `PATCH /api/admin/users/[id]/suspend`) — tidak buat endpoint baru. Tambah satu helper izin `canManageUser()` dipakai 3 handler, lalu satu halaman baru `/admin/users` (server page + client table) yang memanggil endpoint existing. Sidebar SUPER_ADMIN dapat satu sub-item baru.

**Tech Stack:** Next.js 15 App Router, next-auth v4 (JWT), Prisma 6, zod, bcryptjs, @tanstack/react-table via `components/common/DataTable`, Jest (`next/jest`, testEnvironment node).

---

## Kondisi Saat Ini (hasil audit 2026-10-09)

| Kemampuan | Parent (`/admin/parents`) | Tutor (`/admin/tutors`) | Admin | Super Admin |
|---|---|---|---|---|
| Edit nama/email/HP | ✅ | ✅ | ❌ tidak ada UI | ❌ |
| Ganti password | ✅ (field di form edit) | ✅ (field di form edit) | ❌ | ❌ |
| Tangguhkan | ✅ | ✅ | ❌ | — (diblok API) |
| Hapus | ✅ | ❌ tidak ada tombol | ❌ | — (diblok API) |

**Celah keamanan** di `app/api/users/[id]/route.ts`: `PUT` hanya cek actor ADMIN/SUPER_ADMIN, tidak cek role target. Artinya akun **ADMIN bisa ganti password SUPER_ADMIN** lalu login sebagai super admin (privilege escalation). `DELETE` juga membiarkan ADMIN menghapus ADMIN lain. Suspend route sama: ADMIN bisa tangguhkan ADMIN lain.

**Perilaku hapus tutor/admin:** `DELETE` hanya membersihkan data anak milik PARENT. Tutor/admin yang punya `Class`, `LearningReport`, `TutorCheckIn`, `Expense`, `MilestoneReport` → Prisma lempar `P2003` (FK violation) → saat ini jadi 500 dengan pesan mentah. Plan ini mengubahnya jadi 409 dengan pesan "tangguhkan saja". Cascade-delete histori tutor sengaja TIDAK dilakukan (data laporan belajar & keuangan harus tetap ada).

**Suspend efektif?** Ya untuk login baru: `lib/auth.ts` `authorize()` return `null` kalau `user.suspended`. Sesi JWT yang sudah aktif tetap jalan sampai expired (keterbatasan existing, di luar scope).

## Aturan Izin (kontrak)

`canManageUser(actorRole, targetRole)`:
- actor `SUPER_ADMIN` → boleh semua target (aturan khusus SUPER_ADMIN target tetap di handler: tidak bisa dihapus/ditangguhkan).
- actor `ADMIN` → hanya target `TUTOR` atau `PARENT`.
- lainnya → tidak boleh.

Halaman Tutor & Parent existing tidak berubah perilaku untuk ADMIN, karena targetnya memang TUTOR/PARENT.

## File Structure

- Create: `lib/user-permissions.ts` — helper `canManageUser()`.
- Modify: `app/api/users/[id]/route.ts` — `PUT` cek role target; `DELETE` cek izin + map `P2003` → 409.
- Modify: `app/api/admin/users/[id]/suspend/route.ts` — `PATCH` cek izin.
- Create: `__tests__/api/users-id.test.ts` — test PUT/DELETE.
- Create: `__tests__/api/admin-users-suspend.test.ts` — test PATCH suspend.
- Create: `app/(dashboard)/admin/users/page.tsx` — server page, guard SUPER_ADMIN, query semua user.
- Create: `app/(dashboard)/admin/users/UsersClient.tsx` — tabel + filter role + modal edit + modal password + suspend + hapus.
- Modify: `components/dashboard/sidebar.tsx` — sub-item "Manajemen Akun" di menu User SUPER_ADMIN.

---

### Task 1: Helper izin + hardening `PUT`/`DELETE /api/users/[id]`

**Files:**
- Create: `lib/user-permissions.ts`
- Modify: `app/api/users/[id]/route.ts`
- Test: `__tests__/api/users-id.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

Create `__tests__/api/users-id.test.ts`:

```ts
import { PUT, DELETE } from '@/app/api/users/[id]/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('bcryptjs', () => ({ __esModule: true, default: { hash: jest.fn().mockResolvedValue('hashed-pw') } }))
jest.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const asRole = (role: string, id = 'actor') =>
  (getServerSession as jest.Mock).mockResolvedValue({ user: { id, role } })
const target = (role: string) =>
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role, children: [] })

const putReq = (body: object) =>
  new NextRequest('http://localhost/api/users/u1', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
const delReq = () => new NextRequest('http://localhost/api/users/u1', { method: 'DELETE' })
const params = { params: Promise.resolve({ id: 'u1' }) }

describe('PUT /api/users/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('ADMIN tidak boleh ganti password SUPER_ADMIN', async () => {
    asRole('ADMIN')
    target('SUPER_ADMIN')
    const res = await PUT(putReq({ password: 'newpass123' }), params)
    expect(res.status).toBe(403)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('ADMIN tidak boleh edit ADMIN lain', async () => {
    asRole('ADMIN')
    target('ADMIN')
    const res = await PUT(putReq({ name: 'X' }), params)
    expect(res.status).toBe(403)
  })

  it('ADMIN tetap boleh edit TUTOR', async () => {
    asRole('ADMIN')
    target('TUTOR')
    ;(prisma.user.update as jest.Mock).mockResolvedValue({ id: 'u1', name: 'Budi' })
    const res = await PUT(putReq({ name: 'Budi' }), params)
    expect(res.status).toBe(200)
  })

  it('SUPER_ADMIN boleh ganti password ADMIN, password di-hash', async () => {
    asRole('SUPER_ADMIN')
    target('ADMIN')
    ;(prisma.user.update as jest.Mock).mockResolvedValue({ id: 'u1' })
    const res = await PUT(putReq({ password: 'newpass123' }), params)
    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { password: 'hashed-pw' } })
    )
  })

  it('404 kalau user tidak ada', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await PUT(putReq({ name: 'X' }), params)
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/users/[id]', () => {
  beforeEach(() => jest.clearAllMocks())

  it('ADMIN tidak boleh hapus ADMIN', async () => {
    asRole('ADMIN')
    target('ADMIN')
    const res = await DELETE(delReq(), params)
    expect(res.status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('SUPER_ADMIN tidak bisa dihapus', async () => {
    asRole('SUPER_ADMIN')
    target('SUPER_ADMIN')
    const res = await DELETE(delReq(), params)
    expect(res.status).toBe(400)
  })

  it('SUPER_ADMIN boleh hapus ADMIN', async () => {
    asRole('SUPER_ADMIN')
    target('ADMIN')
    const tx = { user: { delete: jest.fn() } }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(tx))
    const res = await DELETE(delReq(), params)
    expect(res.status).toBe(200)
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } })
  })

  it('FK violation (tutor punya kelas/laporan) → 409 dengan saran tangguhkan', async () => {
    asRole('SUPER_ADMIN')
    target('TUTOR')
    ;(prisma.$transaction as jest.Mock).mockRejectedValue({ code: 'P2003', message: 'fk' })
    const res = await DELETE(delReq(), params)
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toMatch(/Tangguhkan/)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `rtk npx jest __tests__/api/users-id.test.ts`
Expected: FAIL — test 403 ADMIN→SUPER_ADMIN/ADMIN dapat 200, test 404 PUT dapat 200/500, test P2003 dapat 500.

- [ ] **Step 3: Buat helper izin**

Create `lib/user-permissions.ts`:

```ts
// ADMIN hanya boleh kelola akun TUTOR & PARENT; akun ADMIN/SUPER_ADMIN hanya oleh SUPER_ADMIN.
export function canManageUser(actorRole: string | undefined, targetRole: string): boolean {
  if (actorRole === 'SUPER_ADMIN') return true
  if (actorRole === 'ADMIN') return targetRole === 'TUTOR' || targetRole === 'PARENT'
  return false
}
```

- [ ] **Step 4: Ubah `PUT` di `app/api/users/[id]/route.ts`**

Tambah import di atas file:

```ts
import { canManageUser } from '@/lib/user-permissions'
```

Di `PUT`, ganti blok:

```ts
  const { id } = await params
  const body = await req.json()
```

menjadi:

```ts
  const { id } = await params
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
  if (!target) return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 })
  if (!canManageUser((session.user as any).role, target.role)) {
    return NextResponse.json({ error: 'Tidak berhak mengubah akun ini.' }, { status: 403 })
  }

  const body = await req.json()
```

- [ ] **Step 5: Ubah `DELETE` di file yang sama**

Setelah blok cek `targetUser.role === 'SUPER_ADMIN'` (return 400), tambahkan:

```ts
    if (!canManageUser((session.user as any).role, targetUser.role)) {
      return NextResponse.json({ error: 'Tidak berhak menghapus akun ini.' }, { status: 403 })
    }
```

Ganti blok `catch` di `DELETE`:

```ts
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menghapus user.' }, { status: 500 })
  }
```

menjadi:

```ts
  } catch (error: any) {
    // P2003 = FK violation: tutor/admin masih punya kelas, laporan, check-in, atau pengeluaran.
    if (error?.code === 'P2003') {
      return NextResponse.json(
        { error: 'User masih memiliki data terkait (kelas, laporan, pengeluaran). Tangguhkan akun sebagai gantinya.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message || 'Gagal menghapus user.' }, { status: 500 })
  }
```

Catatan: SUPER_ADMIN hapus diri sendiri sudah tertutup oleh cek role SUPER_ADMIN; ADMIN hapus diri sendiri tertutup oleh `canManageUser`. Tidak perlu cek self terpisah.

- [ ] **Step 6: Jalankan test, pastikan lulus**

Run: `rtk npx jest __tests__/api/users-id.test.ts`
Expected: PASS 9 tests.

- [ ] **Step 7: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 8: Commit**

```bash
rtk git add lib/user-permissions.ts "app/api/users/[id]/route.ts" __tests__/api/users-id.test.ts
rtk git commit -m "fix(users): cegah ADMIN ubah/hapus akun ADMIN & SUPER_ADMIN

PUT /api/users/[id] tidak cek role target, sehingga ADMIN bisa
ganti password SUPER_ADMIN. DELETE tutor dengan data terkait kini
409 dengan saran tangguhkan, bukan 500.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Hardening `PATCH /api/admin/users/[id]/suspend`

**Files:**
- Modify: `app/api/admin/users/[id]/suspend/route.ts`
- Test: `__tests__/api/admin-users-suspend.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

Create `__tests__/api/admin-users-suspend.test.ts`:

```ts
import { PATCH } from '@/app/api/admin/users/[id]/suspend/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const req = () => new NextRequest('http://localhost/api/admin/users/u1/suspend', { method: 'PATCH' })
const params = { params: Promise.resolve({ id: 'u1' }) }

describe('PATCH /api/admin/users/[id]/suspend', () => {
  beforeEach(() => jest.clearAllMocks())

  it('ADMIN tidak boleh tangguhkan ADMIN lain', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'ADMIN', suspended: false })
    const res = await PATCH(req(), params)
    expect(res.status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('SUPER_ADMIN boleh tangguhkan ADMIN', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 's1', role: 'SUPER_ADMIN' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'ADMIN', suspended: false })
    const tx = {
      user: { update: jest.fn().mockResolvedValue({ id: 'u1', suspended: true, role: 'ADMIN' }) },
      student: { updateMany: jest.fn() },
    }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(tx))
    const res = await PATCH(req(), params)
    expect(res.status).toBe(200)
    expect((await res.json()).suspended).toBe(true)
    expect(tx.student.updateMany).not.toHaveBeenCalled()
  })

  it('SUPER_ADMIN tetap tidak bisa ditangguhkan', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 's1', role: 'SUPER_ADMIN' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'SUPER_ADMIN', suspended: false })
    const res = await PATCH(req(), params)
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `rtk npx jest __tests__/api/admin-users-suspend.test.ts`
Expected: FAIL — test "ADMIN tidak boleh tangguhkan ADMIN lain" dapat 200.

- [ ] **Step 3: Implementasi**

Di `app/api/admin/users/[id]/suspend/route.ts`, tambah import:

```ts
import { canManageUser } from '@/lib/user-permissions'
```

Setelah blok:

```ts
  if (user.role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Cannot suspend admin account' }, { status: 403 })
  }
```

tambahkan:

```ts
  if (!canManageUser((session.user as any).role, user.role)) {
    return NextResponse.json({ error: 'Tidak berhak menangguhkan akun ini.' }, { status: 403 })
  }
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `rtk npx jest __tests__/api/admin-users-suspend.test.ts __tests__/api/users-id.test.ts`
Expected: PASS semua.

- [ ] **Step 5: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 6: Commit**

```bash
rtk git add "app/api/admin/users/[id]/suspend/route.ts" __tests__/api/admin-users-suspend.test.ts
rtk git commit -m "fix(users): ADMIN tidak bisa tangguhkan akun ADMIN lain

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Halaman `/admin/users` (Manajemen Akun) + menu sidebar

**Files:**
- Create: `app/(dashboard)/admin/users/page.tsx`
- Create: `app/(dashboard)/admin/users/UsersClient.tsx`
- Modify: `components/dashboard/sidebar.tsx` (import lucide + sub-item menu User di case `SUPER_ADMIN`)

Tidak ada unit test UI (repo tidak punya test komponen untuk halaman admin); verifikasi lewat `tsc`, lint, dan cek manual di browser (Step 6).

- [ ] **Step 1: Buat server page**

Create `app/(dashboard)/admin/users/page.tsx`:

```tsx
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import UsersClient from './UsersClient'

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/admin')

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, phone: true, role: true, suspended: true, createdAt: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return (
    <UsersClient
      currentUserId={(session.user as any).id}
      initialUsers={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
    />
  )
}
```

- [ ] **Step 2: Buat client component**

Create `app/(dashboard)/admin/users/UsersClient.tsx`:

```tsx
'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/common/DataTable'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useToastNotification } from '@/lib/hooks/use-toast-notification'

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TUTOR' | 'PARENT'

interface User {
  id: string
  name: string
  email: string
  phone: string | null
  role: Role
  suspended: boolean
  createdAt: string
}

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  TUTOR: 'Tutor',
  PARENT: 'Wali Murid',
}

const ROLE_BADGE: Record<Role, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-sky-100 text-sky-700',
  TUTOR: 'bg-indigo-100 text-indigo-700',
  PARENT: 'bg-amber-100 text-amber-700',
}

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500'

const errorText = (data: any, fallback: string) => (typeof data?.error === 'string' ? data.error : fallback)

export default function UsersClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: User[]
  currentUserId: string
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const toast = useToastNotification()
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [editUser, setEditUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' })
  const [pwUser, setPwUser] = useState<User | null>(null)
  const [pwForm, setPwForm] = useState({ password: '', confirm: '' })
  const [saving, setSaving] = useState(false)

  // ponytail: refresh server component, tidak perlu state lokal + endpoint list terpisah
  const users = initialUsers
  const refresh = useCallback(() => router.refresh(), [router])

  const filtered = useMemo(
    () => (roleFilter === 'ALL' ? users : users.filter((u) => u.role === roleFilter)),
    [users, roleFilter]
  )

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUser) return
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) throw new Error(errorText(await res.json(), 'Gagal mengubah data user.'))
      toast.success('Data user diperbarui.')
      setEditUser(null)
      refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pwUser) return
    if (pwForm.password !== pwForm.confirm) {
      toast.error('Konfirmasi password tidak sama.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${pwUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwForm.password }),
      })
      if (!res.ok) throw new Error(errorText(await res.json(), 'Gagal mengganti password.'))
      toast.success(`Password ${pwUser.name} berhasil diganti.`)
      setPwUser(null)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleSuspend = useCallback(
    async (user: User) => {
      const ok = await confirm({
        title: user.suspended ? 'Aktifkan Akun' : 'Tangguhkan Akun',
        message: `${user.suspended ? 'Aktifkan kembali' : 'Tangguhkan'} akun "${user.name}" (${ROLE_LABEL[user.role]})?`,
        variant: user.suspended ? 'info' : 'warning',
        confirmLabel: user.suspended ? 'Aktifkan' : 'Tangguhkan',
      })
      if (!ok) return
      setBusyId(user.id)
      try {
        const res = await fetch(`/api/admin/users/${user.id}/suspend`, { method: 'PATCH' })
        if (!res.ok) throw new Error(errorText(await res.json(), 'Gagal mengubah status.'))
        refresh()
      } catch (err: any) {
        toast.error(err.message)
      } finally {
        setBusyId(null)
      }
    },
    [confirm, toast, refresh]
  )

  const handleDelete = useCallback(
    async (user: User) => {
      const ok = await confirm({
        title: 'Hapus Akun',
        message: `Hapus permanen akun "${user.name}" (${ROLE_LABEL[user.role]})?`,
        detail:
          user.role === 'PARENT'
            ? 'Seluruh data siswa, tagihan, absensi, dan laporan belajar akan ikut terhapus. Tindakan ini TIDAK BISA DIBATALKAN.'
            : 'Tindakan ini TIDAK BISA DIBATALKAN. Akun yang masih punya kelas/laporan/pengeluaran tidak bisa dihapus — tangguhkan saja.',
        variant: 'danger',
        confirmLabel: 'Hapus Permanen',
      })
      if (!ok) return
      setBusyId(user.id)
      try {
        const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error(errorText(await res.json(), 'Gagal menghapus akun.'))
        toast.success('Akun dihapus.')
        refresh()
      } catch (err: any) {
        toast.error(err.message)
      } finally {
        setBusyId(null)
      }
    },
    [confirm, toast, refresh]
  )

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Nama',
        cell: ({ row }) => (
          <span className="font-semibold text-slate-800">
            {row.original.name}
            {row.original.id === currentUserId && <span className="ml-2 text-[11px] text-slate-400">(Anda)</span>}
          </span>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => <span className="text-slate-600">{getValue() as string}</span>,
      },
      {
        accessorKey: 'phone',
        header: 'No. HP',
        cell: ({ getValue }) => <span className="text-slate-500">{(getValue() as string | null) || '-'}</span>,
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ getValue }) => {
          const role = getValue() as Role
          return (
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${ROLE_BADGE[role]}`}>
              {ROLE_LABEL[role]}
            </span>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.suspended ? (
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-600">Ditangguhkan</span>
          ) : (
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Aktif</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const user = row.original
          // Akun SUPER_ADMIN tidak bisa ditangguhkan/dihapus (diblok API juga).
          const protectedAccount = user.role === 'SUPER_ADMIN'
          const btn = 'text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50'
          return (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setEditUser(user)
                  setEditForm({ name: user.name, email: user.email, phone: user.phone || '' })
                }}
                className={`${btn} bg-indigo-50 text-indigo-600 hover:bg-indigo-100`}
              >
                ✏️ Ubah
              </button>
              <button
                onClick={() => {
                  setPwUser(user)
                  setPwForm({ password: '', confirm: '' })
                }}
                className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}
              >
                🔑 Password
              </button>
              {!protectedAccount && (
                <>
                  <button
                    onClick={() => handleToggleSuspend(user)}
                    disabled={busyId === user.id}
                    className={`${btn} ${
                      user.suspended
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    {user.suspended ? '✅ Aktifkan' : '🔒 Tangguhkan'}
                  </button>
                  <button
                    onClick={() => handleDelete(user)}
                    disabled={busyId === user.id}
                    className={`${btn} bg-rose-50 text-rose-600 hover:bg-rose-100`}
                  >
                    🗑️ Hapus
                  </button>
                </>
              )}
            </div>
          )
        },
      },
    ],
    [currentUserId, busyId, handleToggleSuspend, handleDelete]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">🛡️ Manajemen Akun</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola semua akun: ubah data, ganti password, tangguhkan, atau hapus.</p>
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | 'ALL')}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-indigo-500"
        >
          <option value="ALL">Semua Role</option>
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Cari nama atau email..."
          emptyMessage="Tidak ada akun."
          emptyIcon="👤"
        />
      </div>

      {editUser && (
        <Modal title={`✏️ Ubah Data — ${editUser.name}`} onClose={() => setEditUser(null)}>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap *</label>
              <input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
              <input required type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">No. HP (WhatsApp)</label>
              <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className={inputCls} placeholder="mis. 6281234567890" />
            </div>
            <ModalActions saving={saving} onCancel={() => setEditUser(null)} />
          </form>
        </Modal>
      )}

      {pwUser && (
        <Modal title={`🔑 Ganti Password — ${pwUser.name}`} onClose={() => setPwUser(null)}>
          <form onSubmit={handleSavePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Password Baru *</label>
              <input required type="password" minLength={6} value={pwForm.password} onChange={(e) => setPwForm({ ...pwForm, password: e.target.value })} className={inputCls} placeholder="Min. 6 karakter" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Ulangi Password *</label>
              <input required type="password" minLength={6} value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} className={inputCls} />
            </div>
            <ModalActions saving={saving} onCancel={() => setPwUser(null)} />
          </form>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-scaleIn">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50/40">
          <h3 className="font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function ModalActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
      <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
        {saving ? 'Menyimpan...' : 'Simpan'}
      </button>
      <button type="button" onClick={onCancel} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">
        Batal
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Tambah menu di sidebar**

Di `components/dashboard/sidebar.tsx`, tambahkan `UserCog,` ke daftar import `lucide-react` (setelah `Wallet,`).

Di `case 'SUPER_ADMIN':`, sub-item menu `User`, ganti (snippet ini unik karena diawali baris "Monitoring Tutor" yang hanya ada di case SUPER_ADMIN):

```tsx
              { name: 'Monitoring Tutor', href: '/admin/tutor-monitoring', icon: UserCheck },
            ],
          },
          {
            name: 'User',
            icon: Users,
            subItems: [
              { name: 'Siswa', href: '/admin/students', icon: GraduationCap },
              { name: 'Tutor', href: '/admin/tutors', icon: Users },
              { name: 'Wali Murid / Parent', href: '/admin/parents', icon: UsersRound },
            ],
```

menjadi:

```tsx
              { name: 'Monitoring Tutor', href: '/admin/tutor-monitoring', icon: UserCheck },
            ],
          },
          {
            name: 'User',
            icon: Users,
            subItems: [
              { name: 'Siswa', href: '/admin/students', icon: GraduationCap },
              { name: 'Tutor', href: '/admin/tutors', icon: Users },
              { name: 'Wali Murid / Parent', href: '/admin/parents', icon: UsersRound },
              { name: 'Manajemen Akun', href: '/admin/users', icon: UserCog },
            ],
```

Case `ADMIN` TIDAK diubah.

- [ ] **Step 4: Typecheck & lint**

Run: `rtk tsc --noEmit` lalu `rtk lint`
Expected: tidak ada error baru di `app/(dashboard)/admin/users/*`, `components/dashboard/sidebar.tsx`, `lib/user-permissions.ts`.

- [ ] **Step 5: Jalankan seluruh test suite**

Run: `rtk npx jest`
Expected: PASS (tidak ada regresi; test baru Task 1–2 ikut lulus).

- [ ] **Step 6: Verifikasi manual di browser**

Run: `rtk npm run dev`, login sebagai SUPER_ADMIN:
1. Sidebar → User → "Manajemen Akun" muncul; buka `/admin/users` → tabel berisi semua role, filter role berfungsi.
2. Ubah nama sebuah TUTOR → toast sukses, tabel ter-refresh.
3. Ganti password sebuah ADMIN → logout, login sebagai admin itu dengan password baru → berhasil.
4. Tangguhkan ADMIN → coba login sebagai admin itu → gagal. Aktifkan kembali.
5. Hapus tutor yang punya kelas → toast "...Tangguhkan akun sebagai gantinya." (409). Hapus akun ADMIN tanpa data terkait → hilang dari tabel.
6. Baris SUPER_ADMIN: hanya tombol Ubah & Password.
7. Login sebagai ADMIN → menu "Manajemen Akun" tidak ada; buka `/admin/users` langsung → redirect ke `/admin`.

- [ ] **Step 7: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 8: Commit**

```bash
rtk git add "app/(dashboard)/admin/users" components/dashboard/sidebar.tsx
rtk git commit -m "feat(admin): menu Manajemen Akun untuk SUPER_ADMIN

Satu halaman untuk semua role: ubah data, ganti password,
tangguhkan, dan hapus akun memakai endpoint users yang ada.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Di Luar Scope (sengaja dilewati)

- **Tambah akun ADMIN baru** — `POST /api/users` hanya izinkan TUTOR/PARENT. Tambah kalau memang perlu bikin admin dari UI.
- **Log aktivitas user (audit trail)** — tidak ada model log di schema; butuh tabel baru. Tambah kalau yang dimaksud "aktivitas user" adalah riwayat login/aksi.
- **Paksa logout sesi aktif saat ditangguhkan/ganti password** — JWT tidak dicabut; user lama tetap login sampai token expired.
- **Tombol hapus di halaman Tutor** — sudah tersedia lewat Manajemen Akun.
