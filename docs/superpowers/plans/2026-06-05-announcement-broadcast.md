# Announcement Broadcast & Dashboard Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ketika admin menerbitkan pengumuman, sistem otomatis broadcast via WhatsApp ke semua parent dan tutor — dan pengumuman tampil sebagai widget card di dashboard parent dan tutor.

**Architecture:** Tambahkan API endpoint baru `POST /api/announcements/[id]/broadcast` yang mengambil semua parent dan tutor dari DB lalu mengirim WA secara async (non-blocking, dengan rate-limit). Client `AnnouncementsClient` memanggil endpoint ini setelah publish berhasil. Dashboard parent dan tutor mendapat server component `AnnouncementsWidget` yang mem-fetch 3 pengumuman terbaru langsung dari DB.

**Tech Stack:** Next.js 15 App Router, Prisma (PostgreSQL), WAHA (`lib/waha.ts`), React 19, Tailwind CSS 4

---

## File Map

| Action | File | Tanggung Jawab |
|--------|------|----------------|
| Create | `app/api/announcements/[id]/broadcast/route.ts` | POST: kirim WA ke semua parent+tutor |
| Modify | `app/(dashboard)/admin/announcements/AnnouncementsClient.tsx` | Panggil broadcast API setelah publish |
| Create | `components/dashboard/AnnouncementsWidget.tsx` | Server component card pengumuman |
| Modify | `app/(dashboard)/parent/page.tsx` | Tambah AnnouncementsWidget |
| Modify | `app/(dashboard)/tutor/page.tsx` | Tambah AnnouncementsWidget |

---

## Task 1: Create Broadcast API Endpoint

**Files:**
- Create: `app/api/announcements/[id]/broadcast/route.ts`

- [ ] **Step 1: Create the broadcast route file**

```typescript
// app/api/announcements/[id]/broadcast/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendWhatsApp, sleep, randomDelay } from '@/lib/waha'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const announcement = await prisma.announcement.findUnique({ where: { id } })
  if (!announcement) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  if (!announcement.published) return NextResponse.json({ error: 'Announcement not published' }, { status: 400 })

  // Fetch all parents and tutors with phone numbers
  const [parents, tutors] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'PARENT', phone: { not: null } },
      select: { name: true, phone: true },
    }),
    prisma.user.findMany({
      where: { role: 'TUTOR', phone: { not: null } },
      select: { name: true, phone: true },
    }),
  ])

  const message = `📢 *Pengumuman dari Mellyna Education*

*${announcement.title}*

${announcement.content}

_Mellyna Education_`

  // Dispatch WA messages asynchronously — doesn't block the API response
  Promise.resolve().then(async () => {
    const recipients = [...parents, ...tutors]
    for (const user of recipients) {
      if (!user.phone) continue
      console.log(`[WAHA Broadcast] Sending announcement "${announcement.title}" to ${user.name} (${user.phone})`)
      const ok = await sendWhatsApp(user.phone, message)
      if (!ok) {
        console.error(`[WAHA Broadcast] Failed to send to ${user.name}`)
      }
      await sleep(randomDelay(3000, 7000))
    }
    console.log(`[WAHA Broadcast] Announcement broadcast complete: ${recipients.length} recipients`)
  }).catch(console.error)

  return NextResponse.json({ ok: true, recipientCount: parents.length + tutors.length })
}
```

- [ ] **Step 2: Verify the route file is at the correct path**

```bash
ls app/api/announcements/
```
Expected output includes: `[id]/` directory with `broadcast/` inside.

- [ ] **Step 3: Commit**

```bash
git add app/api/announcements/[id]/broadcast/route.ts
git commit -m "feat: add POST /api/announcements/[id]/broadcast endpoint for WA blast"
```

---

## Task 2: Trigger Broadcast from Admin Client

**Files:**
- Modify: `app/(dashboard)/admin/announcements/AnnouncementsClient.tsx`

Context: Ada dua jalur publish — (1) toggle publish pada announcement yang sudah ada via `handleTogglePublish`, (2) create langsung dengan `published: true` via `handleSubmit`. Keduanya harus memicu broadcast.

- [ ] **Step 1: Add `triggerBroadcast` helper and update `handleTogglePublish`**

Buka `app/(dashboard)/admin/announcements/AnnouncementsClient.tsx`.

Tambahkan helper function setelah deklarasi state (sekitar baris 27):

```typescript
  const triggerBroadcast = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/announcements/${id}/broadcast`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        console.log(`[Broadcast] WA dikirim ke ${data.recipientCount} penerima.`)
      } else {
        console.warn(`[Broadcast] Broadcast tidak berhasil: ${data.error}`)
      }
    } catch (e) {
      console.error('[Broadcast] Error saat broadcast:', e)
    }
  }, [])
```

Ganti `handleTogglePublish` yang ada (baris 61–71) menjadi:

```typescript
  const handleTogglePublish = async (id: string, published: boolean) => {
    const willPublish = !published
    try {
      await fetch(`/api/announcements/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: willPublish }),
      })
      await fetchAnnouncements()
      // Trigger WA broadcast only when publishing (not when hiding)
      if (willPublish) {
        await triggerBroadcast(id)
      }
    } catch {
      setError('Gagal memperbarui status pengumuman.')
    }
  }
```

- [ ] **Step 2: Update `handleSubmit` to also broadcast when creating published**

Ganti `handleSubmit` yang ada (baris 40–58) menjadi:

```typescript
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Gagal menyimpan pengumuman.')
      const created = await res.json()
      await fetchAnnouncements()
      setShowForm(false)
      setForm({ title: '', content: '', published: false })
      // Broadcast immediately if created as published
      if (form.published && created?.id) {
        await triggerBroadcast(created.id)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }
```

- [ ] **Step 3: Add `useCallback` to imports (it's already imported — verify)**

Line 3 should already have: `import { useState, useCallback } from 'react'`

Jika belum, update import tersebut.

- [ ] **Step 4: Manual test in browser**

1. Buka `/admin/announcements`
2. Buat announcement baru, centang "Terbitkan sekarang", klik Simpan
3. Buka console browser → cek log `[Broadcast] WA dikirim ke X penerima`
4. Cek console server → cek log `[WAHA Broadcast] Sending announcement ...`
5. Buat announcement draft (tanpa centang), lalu klik tombol "Terbitkan"
6. Cek log yang sama muncul
7. Klik "Sembunyikan" → broadcast TIDAK boleh dipanggil

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/admin/announcements/AnnouncementsClient.tsx
git commit -m "feat: trigger WA broadcast when admin publishes announcement"
```

---

## Task 3: Create AnnouncementsWidget Server Component

**Files:**
- Create: `components/dashboard/AnnouncementsWidget.tsx`

Widget ini adalah server component yang mem-fetch 3 pengumuman terbaru langsung dari DB (tanpa API call). Dapat dipakai di dashboard parent maupun tutor.

- [ ] **Step 1: Create the component**

```typescript
// components/dashboard/AnnouncementsWidget.tsx
import { prisma } from '@/lib/db'

export default async function AnnouncementsWidget() {
  const announcements = await prisma.announcement.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
  })

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">📢 Pengumuman</h2>
      {announcements.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 p-8 text-center text-slate-400 dark:text-slate-500">
          <p className="text-2xl">📭</p>
          <p className="mt-2 text-sm">Belum ada pengumuman.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <div
              key={ann.id}
              className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 shadow-xs p-5"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">📌</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">{ann.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-3">{ann.content}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                    {new Date(ann.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
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
git add components/dashboard/AnnouncementsWidget.tsx
git commit -m "feat: add AnnouncementsWidget server component for dashboards"
```

---

## Task 4: Add Widget to Parent Dashboard

**Files:**
- Modify: `app/(dashboard)/parent/page.tsx`

- [ ] **Step 1: Add import at the top of parent dashboard**

Di `app/(dashboard)/parent/page.tsx`, tambahkan import setelah import `ProgramEnrollmentBadge` (sekitar baris 8):

```typescript
import AnnouncementsWidget from '@/components/dashboard/AnnouncementsWidget'
```

- [ ] **Step 2: Add widget in the right sidebar column**

Cari bagian right column (baris 132–150 kira-kira), yang dimulai dengan:
```
{/* Right column - Summary & Shortcuts */}
```

Tambahkan `<AnnouncementsWidget />` **di atas** card Navigasi Pintar:

```tsx
        {/* Right column - Summary & Shortcuts */}
        <div className="space-y-6">
          <AnnouncementsWidget />

          <div className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 p-6 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-white uppercase tracking-wider">⚡ Navigasi Pintar</h3>
            ...
```

> Catatan: Ganti hanya bagian awal `<div className="space-y-6">` — jangan hapus konten Navigasi Pintar yang sudah ada.

- [ ] **Step 3: Manual check**

Buka `/parent` sebagai user parent → pastikan section "📢 Pengumuman" muncul di kolom kanan, di atas Navigasi Pintar.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/parent/page.tsx
git commit -m "feat: show announcements widget on parent dashboard"
```

---

## Task 5: Add Widget to Tutor Dashboard

**Files:**
- Modify: `app/(dashboard)/tutor/page.tsx`

- [ ] **Step 1: Add import**

Di `app/(dashboard)/tutor/page.tsx`, tambahkan import setelah baris import lainnya:

```typescript
import AnnouncementsWidget from '@/components/dashboard/AnnouncementsWidget'
```

- [ ] **Step 2: Add widget above the schedule section**

Cari bagian return JSX. Setelah banner gradient (tag `<div className="rounded-3xl ...">`) dan sebelum section `<div>` yang berisi jadwal mengajar, tambahkan:

```tsx
      <AnnouncementsWidget />
```

Hasilnya:

```tsx
  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-emerald-800 p-8 text-white shadow-xl shadow-emerald-600/10">
        <h1 className="text-3xl font-extrabold tracking-tight">Dashboard Tutor 👋</h1>
        <p className="mt-2 text-emerald-100">Kelola jadwal mengajar, absensi siswa, dan laporan perkembangan belajar.</p>
      </div>

      <AnnouncementsWidget />

      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">📅 Jadwal Mengajar</h2>
        ...
```

- [ ] **Step 3: Manual check**

Buka `/tutor` sebagai user tutor → pastikan section "📢 Pengumuman" muncul di antara banner dan jadwal mengajar.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/tutor/page.tsx
git commit -m "feat: show announcements widget on tutor dashboard"
```

---

## Self-Review Checklist

- [x] **Spec coverage**:
  - ✅ Broadcast WA ke tutor dan parent saat publish → Task 1 + 2
  - ✅ Card pengumuman di dashboard parent → Task 3 + 4
  - ✅ Card pengumuman di dashboard tutor → Task 3 + 5
  - ✅ Broadcast tidak dipanggil saat "Sembunyikan" → Task 2, `if (willPublish)`
  - ✅ Broadcast dipanggil saat create langsung published → Task 2, `handleSubmit`

- [x] **No placeholders**: Semua step memiliki kode lengkap.

- [x] **Type consistency**: `triggerBroadcast(id: string)` digunakan di dua tempat dengan tanda tangan yang sama. `AnnouncementsWidget` tidak menerima props — dipanggil sebagai `<AnnouncementsWidget />` di kedua dashboard.

- [x] **Phone field**: Endpoint broadcast query `prisma.user.findMany` dengan `where: { role: 'PARENT', phone: { not: null } }` — cocok dengan pola yang dipakai di schedule publish route yang query `parent: { select: { name: true, phone: true } }`.
