# Batch 2 — Analytics & Payment Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four admin features: WA payment reminder blast for overdue invoices, plus a unified Analytics page with three tabs — Absensi Siswa, Performa Tutor, Progress Siswa.

**Architecture:** One aggregation API per analytics domain (attendance, tutor performance, student progress), served to a single `/admin/analytics` page with tab switching. Payment reminder is a separate API + button on the billing page. No new schema changes needed — all data already exists.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, TypeScript, Tailwind CSS, lucide-react, WAHA WhatsApp API.

---

## File Map

**New files:**
- `app/api/admin/billing/remind/route.ts` — POST: WA blast to all parents with PENDING invoices
- `app/api/admin/analytics/attendance/route.ts` — GET: per-student attendance summary
- `app/api/admin/analytics/tutors/route.ts` — GET: per-tutor performance summary
- `app/api/admin/analytics/students/route.ts` — GET: per-student progress summary
- `app/(dashboard)/admin/analytics/page.tsx` — Analytics page with 3 tabs

**Modified files:**
- `app/(dashboard)/admin/billing/page.tsx` — add "Kirim Pengingat WA" button + result toast
- `components/dashboard/sidebar.tsx` — add "Analitik" nav item for SUPER_ADMIN

---

## Task 1: Create POST `/api/admin/billing/remind`

**Files:**
- Create: `app/api/admin/billing/remind/route.ts`

Finds all PENDING invoices, groups by parent, sends one WA message per parent summarizing their overdue invoices.

- [ ] **Step 1: Write the route file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendWhatsApp } from '@/lib/waha'
import { formatRupiah } from '@/lib/utils'

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const invoices = await prisma.invoice.findMany({
    where: { status: 'PENDING' },
    include: {
      student: {
        include: {
          parent: { select: { id: true, name: true, phone: true } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  })

  // Group invoices by parent
  const byParent = new Map<string, { parent: { name: string; phone: string | null }, items: typeof invoices }>()
  for (const inv of invoices) {
    const parentId = inv.student.parent.id
    if (!byParent.has(parentId)) {
      byParent.set(parentId, { parent: inv.student.parent, items: [] })
    }
    byParent.get(parentId)!.items.push(inv)
  }

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const { parent, items } of byParent.values()) {
    if (!parent.phone) { skipped++; continue }

    const itemLines = items
      .map((inv) => `• ${inv.student.name}: ${formatRupiah(inv.amount)} (jatuh tempo ${new Date(inv.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })})`)
      .join('\n')

    const total = items.reduce((sum, inv) => sum + inv.amount, 0)

    const message = `Halo ${parent.name},

Ini adalah pengingat tagihan bimbingan belajar yang belum dibayar:

${itemLines}

Total: ${formatRupiah(total)}

Silakan lakukan pembayaran melalui portal atau hubungi kami jika ada pertanyaan.

Terima kasih,
Mellyna Education`

    const ok = await sendWhatsApp(parent.phone, message)
    if (ok) sent++; else failed++
  }

  return NextResponse.json({ sent, failed, skipped, total: byParent.size })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/billing/remind/route.ts
git commit -m "feat: add POST /api/admin/billing/remind for WA payment reminder blast"
```

---

## Task 2: Add "Kirim Pengingat WA" Button to Admin Billing Page

**Files:**
- Modify: `app/(dashboard)/admin/billing/page.tsx`

- [ ] **Step 1: Add `reminding` and `remindResult` state after existing state declarations**

```typescript
const [reminding, setReminding] = useState(false)
const [remindResult, setRemindResult] = useState<{ sent: number; failed: number; skipped: number; total: number } | null>(null)
```

- [ ] **Step 2: Add `handleRemind` handler**

After `fetchStudentList`, add:
```typescript
const handleRemind = async () => {
  if (!confirm('Kirim pengingat WA ke semua orang tua dengan tagihan PENDING?')) return
  setReminding(true)
  setRemindResult(null)
  try {
    const res = await fetch('/api/admin/billing/remind', { method: 'POST' })
    if (!res.ok) throw new Error()
    setRemindResult(await res.json())
  } catch {
    setError('Gagal mengirim pengingat.')
  } finally {
    setReminding(false)
  }
}
```

- [ ] **Step 3: Add the button next to the existing "Buat Invoice" button**

In the header section, find the `<button onClick={() => setShowForm(true)}` block. Add a "Kirim Pengingat WA" button next to it:

```tsx
<div className="flex gap-2">
  <button
    onClick={handleRemind}
    disabled={reminding}
    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
  >
    <MessageCircle className="h-4 w-4" />
    {reminding ? 'Mengirim...' : 'Kirim Pengingat WA'}
  </button>
  <button
    onClick={() => setShowForm(true)}
    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
  >
    <Plus className="h-4 w-4" /> Buat Invoice
  </button>
</div>
```

Add `MessageCircle` to lucide imports.

- [ ] **Step 4: Add result banner below the error div**

After the existing `{error && ...}` block, add:
```tsx
{remindResult && (
  <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
    ✅ Pengingat terkirim: <strong>{remindResult.sent}</strong> berhasil, {remindResult.failed} gagal, {remindResult.skipped} dilewati (tidak ada HP).
    <button onClick={() => setRemindResult(null)} className="ml-3 text-emerald-500 hover:text-emerald-700 font-bold cursor-pointer">✕</button>
  </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/admin/billing/page.tsx"
git commit -m "feat: add WA payment reminder blast button to admin billing page"
```

---

## Task 3: Create GET `/api/admin/analytics/attendance`

**Files:**
- Create: `app/api/admin/analytics/attendance/route.ts`

Returns per-student attendance summary. Optional `startDate` and `endDate` query params for date range filtering.

- [ ] **Step 1: Write the route file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const dateFilter = startDate || endDate ? {
    schedule: {
      date: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      },
    },
  } : {}

  const students = await prisma.student.findMany({
    select: {
      id: true,
      name: true,
      grade: true,
      attendances: {
        where: dateFilter,
        select: { status: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const result = students.map((s) => {
    const total = s.attendances.length
    const present = s.attendances.filter((a) => a.status === 'PRESENT').length
    const absent = s.attendances.filter((a) => a.status === 'ABSENT').length
    const sick = s.attendances.filter((a) => a.status === 'SICK').length
    const permission = s.attendances.filter((a) => a.status === 'PERMISSION').length
    const rate = total > 0 ? Math.round((present / total) * 100) : null

    return { id: s.id, name: s.name, grade: s.grade, total, present, absent, sick, permission, rate }
  })

  return NextResponse.json(result)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/analytics/attendance/route.ts
git commit -m "feat: add GET /api/admin/analytics/attendance for per-student attendance summary"
```

---

## Task 4: Create GET `/api/admin/analytics/tutors`

**Files:**
- Create: `app/api/admin/analytics/tutors/route.ts`

Returns per-tutor performance: total schedules, reports filled, avg student attendance rate.

- [ ] **Step 1: Write the route file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tutors = await prisma.user.findMany({
    where: { role: Role.TUTOR },
    select: {
      id: true,
      name: true,
      email: true,
      suspended: true,
      tutorClasses: {
        select: {
          schedules: {
            select: {
              id: true,
              status: true,
              reports: { select: { id: true } },
              attendances: { select: { status: true } },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const result = tutors.map((t) => {
    const schedules = t.tutorClasses.flatMap((c) => c.schedules)
    const totalSchedules = schedules.length
    const completedSchedules = schedules.filter((s) => s.status === 'COMPLETED').length
    const reportsFilled = schedules.filter((s) => s.reports.length > 0).length
    const reportRate = totalSchedules > 0 ? Math.round((reportsFilled / totalSchedules) * 100) : null

    const allAttendances = schedules.flatMap((s) => s.attendances)
    const presentCount = allAttendances.filter((a) => a.status === 'PRESENT').length
    const avgAttendanceRate = allAttendances.length > 0 ? Math.round((presentCount / allAttendances.length) * 100) : null

    return {
      id: t.id,
      name: t.name,
      email: t.email,
      suspended: t.suspended,
      totalSchedules,
      completedSchedules,
      reportsFilled,
      reportRate,
      avgAttendanceRate,
    }
  })

  return NextResponse.json(result)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/analytics/tutors/route.ts
git commit -m "feat: add GET /api/admin/analytics/tutors for tutor performance summary"
```

---

## Task 5: Create GET `/api/admin/analytics/students`

**Files:**
- Create: `app/api/admin/analytics/students/route.ts`

Returns per-student progress: avg score, last score, total reports, attendance rate, last activity date.

- [ ] **Step 1: Write the route file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const students = await prisma.student.findMany({
    select: {
      id: true,
      name: true,
      grade: true,
      isActive: true,
      reports: {
        select: { score: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      attendances: {
        select: { status: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const result = students.map((s) => {
    const scoredReports = s.reports.filter((r) => r.score !== null)
    const avgScore = scoredReports.length > 0
      ? Math.round(scoredReports.reduce((sum, r) => sum + r.score!, 0) / scoredReports.length)
      : null
    const lastScore = scoredReports[0]?.score ?? null
    const lastActivity = s.reports[0]?.createdAt ?? null

    const total = s.attendances.length
    const present = s.attendances.filter((a) => a.status === 'PRESENT').length
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null

    // Trend: compare last 2 scored reports
    let trend: 'up' | 'down' | 'stable' | null = null
    if (scoredReports.length >= 2) {
      const diff = scoredReports[0].score! - scoredReports[1].score!
      if (diff > 5) trend = 'up'
      else if (diff < -5) trend = 'down'
      else trend = 'stable'
    }

    return {
      id: s.id,
      name: s.name,
      grade: s.grade,
      isActive: s.isActive,
      totalReports: s.reports.length,
      avgScore,
      lastScore,
      lastActivity,
      attendanceRate,
      trend,
    }
  })

  return NextResponse.json(result)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/analytics/students/route.ts
git commit -m "feat: add GET /api/admin/analytics/students for per-student progress summary"
```

---

## Task 6: Create Admin Analytics Page with 3 Tabs

**Files:**
- Create: `app/(dashboard)/admin/analytics/page.tsx`

Three tabs: Absensi Siswa, Performa Tutor, Progress Siswa. Each tab fetches its own API.

- [ ] **Step 1: Write the full page**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'

type Tab = 'attendance' | 'tutors' | 'students'

interface AttendanceStat {
  id: string; name: string; grade: string | null
  total: number; present: number; absent: number; sick: number; permission: number; rate: number | null
}

interface TutorStat {
  id: string; name: string; email: string; suspended: boolean
  totalSchedules: number; completedSchedules: number; reportsFilled: number
  reportRate: number | null; avgAttendanceRate: number | null
}

interface StudentStat {
  id: string; name: string; grade: string | null; isActive: boolean
  totalReports: number; avgScore: number | null; lastScore: number | null
  lastActivity: string | null; attendanceRate: number | null; trend: 'up' | 'down' | 'stable' | null
}

const RateBar = ({ value }: { value: number | null }) => {
  if (value === null) return <span className="text-slate-400 text-xs">—</span>
  const color = value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-700 w-8 text-right">{value}%</span>
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const [tab, setTab] = useState<Tab>('attendance')
  const [attendance, setAttendance] = useState<AttendanceStat[]>([])
  const [tutors, setTutors] = useState<TutorStat[]>([])
  const [students, setStudents] = useState<StudentStat[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const fetchData = useCallback(async (t: Tab) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/analytics/${t}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (t === 'attendance') setAttendance(data)
      else if (t === 'tutors') setTutors(data)
      else setStudents(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(tab) }, [tab, fetchData])

  const tabs: { key: Tab; label: string; emoji: string }[] = [
    { key: 'attendance', label: 'Absensi Siswa', emoji: '📋' },
    { key: 'tutors', label: 'Performa Tutor', emoji: '👩‍🏫' },
    { key: 'students', label: 'Progress Siswa', emoji: '📈' },
  ]

  const trendIcon = (t: StudentStat['trend']) =>
    t === 'up' ? '📈' : t === 'down' ? '📉' : t === 'stable' ? '➡️' : '—'

  const filteredAttendance = attendance.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
  const filteredTutors = tutors.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
  const filteredStudents = students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800">📊 Analitik</h1>
        <p className="text-sm text-slate-500 mt-0.5">Ringkasan performa tutor, absensi, dan perkembangan siswa.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch('') }}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              tab === t.key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Cari nama..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-xs px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
      />

      {loading ? (
        <div className="p-10 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
        </div>
      ) : (
        <>
          {/* Attendance Tab */}
          {tab === 'attendance' && (
            <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      {['Siswa', 'Kelas', 'Total Sesi', 'Hadir', 'Alpha', 'Sakit', 'Izin', 'Kehadiran'].map((h) => (
                        <th key={h} className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAttendance.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-10 text-slate-400">Belum ada data absensi.</td></tr>
                    ) : filteredAttendance.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3.5 font-semibold text-slate-800">{s.name}</td>
                        <td className="px-5 py-3.5 text-slate-500">{s.grade || '—'}</td>
                        <td className="px-5 py-3.5 text-slate-600">{s.total}</td>
                        <td className="px-5 py-3.5 text-emerald-600 font-semibold">{s.present}</td>
                        <td className="px-5 py-3.5 text-rose-500 font-semibold">{s.absent}</td>
                        <td className="px-5 py-3.5 text-amber-500">{s.sick}</td>
                        <td className="px-5 py-3.5 text-blue-500">{s.permission}</td>
                        <td className="px-5 py-3.5 w-36"><RateBar value={s.rate} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tutors Tab */}
          {tab === 'tutors' && (
            <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      {['Tutor', 'Status', 'Total Jadwal', 'Selesai', 'Laporan Terisi', 'Rate Laporan', 'Kehadiran Siswa'].map((h) => (
                        <th key={h} className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTutors.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-10 text-slate-400">Belum ada data tutor.</td></tr>
                    ) : filteredTutors.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-slate-800">{t.name}</p>
                          <p className="text-xs text-slate-400">{t.email}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          {t.suspended
                            ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">Ditangguhkan</span>
                            : <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Aktif</span>}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{t.totalSchedules}</td>
                        <td className="px-5 py-3.5 text-slate-600">{t.completedSchedules}</td>
                        <td className="px-5 py-3.5 text-slate-600">{t.reportsFilled} / {t.totalSchedules}</td>
                        <td className="px-5 py-3.5 w-32"><RateBar value={t.reportRate} /></td>
                        <td className="px-5 py-3.5 w-32"><RateBar value={t.avgAttendanceRate} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Students Progress Tab */}
          {tab === 'students' && (
            <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      {['Siswa', 'Kelas', 'Status', 'Laporan', 'Nilai Rata-Rata', 'Nilai Terakhir', 'Tren', 'Kehadiran', 'Aktivitas Terakhir'].map((h) => (
                        <th key={h} className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-10 text-slate-400">Belum ada data siswa.</td></tr>
                    ) : filteredStudents.map((s) => (
                      <tr key={s.id} className={`hover:bg-slate-50/50 ${!s.isActive ? 'opacity-50' : ''}`}>
                        <td className="px-5 py-3.5 font-semibold text-slate-800">{s.name}</td>
                        <td className="px-5 py-3.5 text-slate-500">{s.grade || '—'}</td>
                        <td className="px-5 py-3.5">
                          {s.isActive
                            ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Aktif</span>
                            : <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Nonaktif</span>}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{s.totalReports}</td>
                        <td className="px-5 py-3.5 font-semibold text-indigo-600">{s.avgScore ?? '—'}</td>
                        <td className="px-5 py-3.5 text-slate-600">{s.lastScore ?? '—'}</td>
                        <td className="px-5 py-3.5 text-lg">{trendIcon(s.trend)}</td>
                        <td className="px-5 py-3.5 w-32"><RateBar value={s.attendanceRate} /></td>
                        <td className="px-5 py-3.5 text-slate-400 text-xs whitespace-nowrap">
                          {s.lastActivity ? new Date(s.lastActivity).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(dashboard)/admin/analytics/page.tsx"
git commit -m "feat: add admin analytics page with attendance, tutor, and student progress tabs"
```

---

## Task 7: Add "Analitik" to Admin Sidebar

**Files:**
- Modify: `components/dashboard/sidebar.tsx`

- [ ] **Step 1: Add `BarChart2` to lucide import**

Find the lucide import and add `BarChart2`.

- [ ] **Step 2: Add Analitik entry to SUPER_ADMIN nav links**

Add before "Laporan":
```typescript
{ name: 'Analitik', href: '/admin/analytics', icon: BarChart2 },
```

Final order: Dashboard, Siswa, Tutor, Kelas, Jadwal, Tagihan, Pengumuman, **Analitik**, Laporan, Pengaturan.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/sidebar.tsx
git commit -m "feat: add Analitik link to admin sidebar"
```

---

## Self-Review

**Spec coverage:**
- ✅ Payment reminder WA: Tasks 1-2
- ✅ Attendance analytics per student: Tasks 3+6 (attendance tab)
- ✅ Tutor performance: Tasks 4+6 (tutors tab)
- ✅ Student progress (admin): Tasks 5+6 (students tab)
- ✅ Analytics added to sidebar: Task 7

**Edge cases:**
- Parents with no phone → skipped in reminder, counted in `skipped`
- Students with 0 attendance → rate shows `—` not 0%
- Tutors with 0 schedules → all metrics show `—`
- Students with only 1 report → trend is `null` (need ≥2 scored reports)
