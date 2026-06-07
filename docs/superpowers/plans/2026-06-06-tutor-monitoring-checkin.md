# Tutor Monitoring Dashboard & GPS Check-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah fitur absensi harian tutor berbasis GPS (sekali per hari, radius 500m dari -7.041736, 113.558258) dan dashboard monitoring tutor untuk admin.

**Architecture:** Model `TutorCheckIn` menyimpan satu record per tutor per tanggal (bukan per jadwal). Tutor cukup absen sekali ketika tiba di lokasi — satu tombol di atas dashboard berlaku untuk semua jadwal hari itu. Server memvalidasi radius dengan Haversine formula. Admin mendapat halaman monitoring dengan ringkasan per tutor dan riwayat absen harian.

**Tech Stack:** Next.js 14 App Router, Prisma ORM, NextAuth, TailwindCSS, Lucide Icons, Jest

---

## Skema Database

```
TutorCheckIn (absensi HARIAN, bukan per jadwal)
├── id             String   @id @default(cuid())
├── tutorId        String   → User (role=TUTOR)
├── date           String   format "YYYY-MM-DD" (timezone WIB)
├── checkedInAt    DateTime @default(now())
├── latitude       Float    (koordinat GPS tutor saat absen)
├── longitude      Float
├── distanceM      Float    (jarak dari titik pusat dalam meter)
├── isWithinRadius Boolean  (true jika ≤ 500m dari titik pusat)
└── @@unique([tutorId, date])  ← satu absen per tutor per hari

Titik Pusat Absensi:
  lat: -7.041736
  lng: 113.558258
  radius: 500 meter
  timezone: WIB (UTC+7)
```

---

## Flow Absensi Tutor

```
Tutor buka dashboard hari ini
  → Lihat banner absensi di atas (dengan tanggal hari ini)
  → Jika belum absen: tampil tombol [Absen Sekarang]
  → Klik → browser minta izin GPS
  → Frontend kirim POST /api/tutor-checkin
      { latitude, longitude }
  → Server tentukan date = hari ini (WIB)
  → Server cek: ada jadwal hari ini? (wajib ada)
  → Server hitung jarak (Haversine)
  → isWithinRadius = distanceM ≤ 500m
  → Simpan TutorCheckIn (upsert per tutorId+date)
  → Return { success, isWithinRadius, distanceM, checkedInAt }
  → UI: tombol hilang, tampil "Sudah absen pukul 08:45 (105m)"
```

---

## File Structure

**Baru:**
- `lib/geolocation.ts` — Haversine + radius check + date helper WIB
- `__tests__/lib/geolocation.test.ts` — Unit tests
- `app/api/tutor-checkin/route.ts` — POST absen harian, GET status hari ini
- `app/api/admin/tutor-monitoring/route.ts` — GET stats per tutor per bulan
- `components/dashboard/TutorDailyCheckIn.tsx` — Banner absensi harian di dashboard tutor
- `app/(dashboard)/admin/tutor-monitoring/page.tsx` — Halaman server
- `app/(dashboard)/admin/tutor-monitoring/TutorMonitoringClient.tsx` — Halaman client
- `app/(dashboard)/admin/tutor-monitoring/loading.tsx` — Loading skeleton

**Diubah:**
- `prisma/schema.prisma` — Tambah model TutorCheckIn + relasi ke User saja
- `components/dashboard/sidebar.tsx` — Tambah menu "Monitoring Tutor"
- `app/(dashboard)/tutor/page.tsx` — Tambah komponen TutorDailyCheckIn di atas

---

## Task 1: Prisma Schema — Model TutorCheckIn

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Tambah model TutorCheckIn**

Di `prisma/schema.prisma`, tambahkan model baru setelah model `Attendance`:

```prisma
model TutorCheckIn {
  id             String   @id @default(cuid())
  tutorId        String
  date           String
  checkedInAt    DateTime @default(now())
  latitude       Float
  longitude      Float
  distanceM      Float
  isWithinRadius Boolean
  tutor          User     @relation("TutorCheckIns", fields: [tutorId], references: [id])

  @@unique([tutorId, date])
}
```

Di model `User`, tambahkan relasi (di dalam blok field sebelum closing `}`):
```prisma
  tutorCheckIns  TutorCheckIn[] @relation("TutorCheckIns")
```

**Catatan:** Tidak perlu relasi ke `Schedule` karena absensi per hari, bukan per jadwal.

- [ ] **Step 2: Jalankan migration**

```bash
npx prisma migrate dev --name add-tutor-checkin
```

Expected output:
```
✔ Generated Prisma Client
The following migration(s) have been applied:
  migrations/XXXXXXXX_add_tutor_checkin/migration.sql
```

- [ ] **Step 3: Verifikasi**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add TutorCheckIn model for daily GPS-based tutor attendance"
```

---

## Task 2: Geolocation Utility

**Files:**
- Create: `lib/geolocation.ts`
- Create: `__tests__/lib/geolocation.test.ts`

- [ ] **Step 1: Tulis failing test**

Buat `__tests__/lib/geolocation.test.ts`:

```typescript
import { haversineDistance, checkRadius, getTodayWIB, CHECKIN_CENTER, CHECKIN_RADIUS_METERS } from '@/lib/geolocation'

describe('haversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistance(-7.041736, 113.558258, -7.041736, 113.558258)).toBe(0)
  })

  it('calculates ~667m for 0.006 degree latitude difference', () => {
    const d = haversineDistance(-7.041736, 113.558258, -7.035736, 113.558258)
    expect(d).toBeGreaterThan(600)
    expect(d).toBeLessThan(750)
  })
})

describe('checkRadius', () => {
  it('center point is within radius', () => {
    const result = checkRadius(CHECKIN_CENTER.lat, CHECKIN_CENTER.lng)
    expect(result.isWithinRadius).toBe(true)
    expect(result.distanceM).toBe(0)
  })

  it('point ~111m away is within 500m radius', () => {
    const result = checkRadius(-7.040736, 113.558258)
    expect(result.isWithinRadius).toBe(true)
    expect(result.distanceM).toBeGreaterThan(50)
    expect(result.distanceM).toBeLessThan(200)
  })

  it('point ~667m away is outside 500m radius', () => {
    const result = checkRadius(-7.035736, 113.558258)
    expect(result.isWithinRadius).toBe(false)
    expect(result.distanceM).toBeGreaterThan(CHECKIN_RADIUS_METERS)
  })

  it('radius constant is 500', () => {
    expect(CHECKIN_RADIUS_METERS).toBe(500)
  })
})

describe('getTodayWIB', () => {
  it('returns string in YYYY-MM-DD format', () => {
    const result = getTodayWIB()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan FAIL**

```bash
npx jest __tests__/lib/geolocation.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/geolocation'`

- [ ] **Step 3: Implementasi lib/geolocation.ts**

Buat `lib/geolocation.ts`:

```typescript
export const CHECKIN_CENTER = { lat: -7.041736, lng: 113.558258 }
export const CHECKIN_RADIUS_METERS = 500

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function checkRadius(
  lat: number,
  lng: number,
): { isWithinRadius: boolean; distanceM: number } {
  const distanceM = haversineDistance(lat, lng, CHECKIN_CENTER.lat, CHECKIN_CENTER.lng)
  return { isWithinRadius: distanceM <= CHECKIN_RADIUS_METERS, distanceM }
}

// Kembalikan tanggal hari ini dalam timezone WIB (UTC+7) format "YYYY-MM-DD"
export function getTodayWIB(): string {
  const wibOffset = 7 * 60 * 60 * 1000
  const wibDate = new Date(Date.now() + wibOffset)
  return wibDate.toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Jalankan test, pastikan PASS**

```bash
npx jest __tests__/lib/geolocation.test.ts --no-coverage
```

Expected: `Tests: 7 passed, 7 total`

- [ ] **Step 5: Commit**

```bash
git add lib/geolocation.ts __tests__/lib/geolocation.test.ts
git commit -m "feat: add geolocation utility with haversine, radius check, and WIB date helper"
```

---

## Task 3: Tutor Check-In API

**Files:**
- Create: `app/api/tutor-checkin/route.ts`

- [ ] **Step 1: Buat API route**

Buat `app/api/tutor-checkin/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkRadius, getTodayWIB } from '@/lib/geolocation'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tutorId = (session.user as any).id
  const body = await req.json()
  const { latitude, longitude } = body

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return NextResponse.json({ error: 'latitude dan longitude wajib diisi' }, { status: 400 })
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: 'Koordinat GPS tidak valid' }, { status: 400 })
  }

  const today = getTodayWIB()

  // Pastikan tutor punya jadwal hari ini
  const todayStart = new Date(`${today}T00:00:00+07:00`)
  const todayEnd = new Date(`${today}T23:59:59+07:00`)
  const hasScheduleToday = await prisma.schedule.findFirst({
    where: {
      date: { gte: todayStart, lte: todayEnd },
      status: { in: ['PUBLISHED', 'COMPLETED'] },
      OR: [
        { class: { tutorId } },
        { class: { additionalTutors: { some: { tutorId } } } },
      ],
    },
  })
  if (!hasScheduleToday) {
    return NextResponse.json(
      { error: 'Tidak ada jadwal mengajar hari ini.' },
      { status: 422 },
    )
  }

  const { isWithinRadius, distanceM } = checkRadius(latitude, longitude)

  const checkIn = await prisma.tutorCheckIn.upsert({
    where: { tutorId_date: { tutorId, date: today } },
    update: { latitude, longitude, distanceM, isWithinRadius, checkedInAt: new Date() },
    create: { tutorId, date: today, latitude, longitude, distanceM, isWithinRadius },
  })

  if (!isWithinRadius) {
    return NextResponse.json(
      {
        success: false,
        isWithinRadius: false,
        distanceM: Math.round(distanceM),
        message: `Anda berada ${Math.round(distanceM)}m dari lokasi bimbel. Maksimal 500m.`,
      },
      { status: 422 },
    )
  }

  return NextResponse.json({
    success: true,
    isWithinRadius: true,
    distanceM: Math.round(distanceM),
    checkedInAt: checkIn.checkedInAt.toISOString(),
    message: `Absen berhasil! Jarak: ${Math.round(distanceM)}m`,
  })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tutorId = (session.user as any).id
  const today = getTodayWIB()

  const checkIn = await prisma.tutorCheckIn.findUnique({
    where: { tutorId_date: { tutorId, date: today } },
  })

  return NextResponse.json(
    checkIn
      ? {
          checkedIn: checkIn.isWithinRadius,
          checkedInAt: checkIn.checkedInAt.toISOString(),
          distanceM: Math.round(checkIn.distanceM),
          isWithinRadius: checkIn.isWithinRadius,
        }
      : { checkedIn: false },
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/tutor-checkin/route.ts
git commit -m "feat: add daily tutor check-in API with GPS radius and schedule validation"
```

---

## Task 4: TutorDailyCheckIn Component

**Files:**
- Create: `components/dashboard/TutorDailyCheckIn.tsx`

- [ ] **Step 1: Buat komponen**

Buat `components/dashboard/TutorDailyCheckIn.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { MapPin, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

interface Props {
  todayLabel: string      // "Sabtu, 6 Juni 2026"
  initialCheckedIn: boolean
  initialCheckedInAt?: string   // ISO string jam absen
  initialDistanceM?: number
  hasScheduleToday: boolean
}

type Status = 'idle' | 'locating' | 'sending' | 'success' | 'outside' | 'error' | 'no-schedule'

export function TutorDailyCheckIn({
  todayLabel,
  initialCheckedIn,
  initialCheckedInAt,
  initialDistanceM,
  hasScheduleToday,
}: Props) {
  const [status, setStatus] = useState<Status>(
    initialCheckedIn ? 'success' : !hasScheduleToday ? 'no-schedule' : 'idle',
  )
  const [checkedInAt, setCheckedInAt] = useState<string | null>(initialCheckedInAt ?? null)
  const [distanceM, setDistanceM] = useState<number | null>(initialDistanceM ?? null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleAbsen = () => {
    if (!navigator.geolocation) {
      setStatus('error')
      setErrorMsg('Browser tidak mendukung GPS.')
      return
    }
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setStatus('sending')
        try {
          const res = await fetch('/api/tutor-checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          })
          const data = await res.json()
          if (data.isWithinRadius) {
            setStatus('success')
            setCheckedInAt(data.checkedInAt)
            setDistanceM(data.distanceM)
          } else {
            setStatus('outside')
            setErrorMsg(data.message)
          }
        } catch {
          setStatus('error')
          setErrorMsg('Gagal menghubungi server.')
        }
      },
      (err) => {
        setStatus('error')
        setErrorMsg(`Gagal mendapatkan GPS: ${err.message}`)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  }

  const checkedInTime = checkedInAt
    ? new Date(checkedInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
        status === 'success'
          ? 'bg-emerald-50 border-emerald-200'
          : status === 'outside' || status === 'error'
            ? 'bg-rose-50 border-rose-200'
            : status === 'no-schedule'
              ? 'bg-slate-50 border-slate-200'
              : 'bg-teal-50 border-teal-200'
      }`}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <MapPin
            className={`h-4 w-4 shrink-0 ${
              status === 'success'
                ? 'text-emerald-600'
                : status === 'outside' || status === 'error'
                  ? 'text-rose-500'
                  : 'text-teal-600'
            }`}
          />
          <p className="font-bold text-slate-800 text-sm">Absensi Harian</p>
        </div>
        <p className="text-xs text-slate-500">{todayLabel}</p>

        {status === 'success' && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold text-emerald-700">
              Sudah absen pukul {checkedInTime}
              {distanceM !== null && (
                <span className="font-normal text-emerald-600"> ({distanceM}m dari lokasi)</span>
              )}
            </p>
          </div>
        )}

        {status === 'outside' && (
          <div className="flex items-start gap-1.5 mt-1.5">
            <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-600">{errorMsg}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-1.5 mt-1.5">
            <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-600">{errorMsg}</p>
          </div>
        )}

        {status === 'no-schedule' && (
          <p className="text-sm text-slate-400 mt-1">Tidak ada jadwal mengajar hari ini.</p>
        )}

        {(status === 'locating' || status === 'sending') && (
          <p className="text-sm text-teal-600 mt-1 flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {status === 'locating' ? 'Mendeteksi lokasi GPS...' : 'Menyimpan absensi...'}
          </p>
        )}
      </div>

      {(status === 'idle' || status === 'outside' || status === 'error') && (
        <button
          onClick={handleAbsen}
          disabled={status === 'locating' || status === 'sending'}
          className="shrink-0 flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
        >
          <MapPin className="h-4 w-4" />
          Absen Sekarang
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/TutorDailyCheckIn.tsx
git commit -m "feat: add TutorDailyCheckIn banner component for daily GPS attendance"
```

---

## Task 5: Update Tutor Dashboard Page

**Files:**
- Modify: `app/(dashboard)/tutor/page.tsx`

- [ ] **Step 1: Baca file saat ini**

Baca `app/(dashboard)/tutor/page.tsx`.

- [ ] **Step 2: Ganti isi file**

Ganti seluruh isi `app/(dashboard)/tutor/page.tsx` dengan:

```tsx
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { TutorLocationEdit } from '@/components/dashboard/TutorLocationEdit'
import AnnouncementsWidget from '@/components/dashboard/AnnouncementsWidget'
import { TutorDailyCheckIn } from '@/components/dashboard/TutorDailyCheckIn'
import { getTodayWIB } from '@/lib/geolocation'

export default async function TutorDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id

  const today = getTodayWIB()
  const todayStart = new Date(`${today}T00:00:00+07:00`)
  const todayEnd = new Date(`${today}T23:59:59+07:00`)

  const [schedules, todayCheckIn, hasScheduleToday] = await Promise.all([
    prisma.schedule.findMany({
      where: {
        OR: [
          { class: { tutorId: userId } },
          { class: { additionalTutors: { some: { tutorId: userId } } } },
        ],
        date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      include: {
        class: { select: { name: true, _count: { select: { enrollments: true } } } },
        _count: { select: { reports: true, participants: true } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.tutorCheckIn.findUnique({
      where: { tutorId_date: { tutorId: userId, date: today } },
    }),
    prisma.schedule.findFirst({
      where: {
        date: { gte: todayStart, lte: todayEnd },
        status: { in: ['PUBLISHED', 'COMPLETED'] },
        OR: [
          { class: { tutorId: userId } },
          { class: { additionalTutors: { some: { tutorId: userId } } } },
        ],
      },
    }),
  ])

  const todayLabel = new Date(todayStart).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const statusColor = {
    DRAFT: 'bg-slate-100 text-slate-600',
    PUBLISHED: 'bg-emerald-100 text-emerald-700',
    COMPLETED: 'bg-indigo-100 text-indigo-700',
    CANCELLED: 'bg-rose-100 text-rose-700',
  }

  const isNewlyPublished = (s: (typeof schedules)[0]) =>
    s.publishedAt !== null &&
    Date.now() - new Date(s.publishedAt).getTime() < 24 * 60 * 60 * 1000

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-emerald-800 p-8 text-white shadow-xl shadow-emerald-600/10">
        <h1 className="text-3xl font-extrabold tracking-tight">Dashboard Tutor 👋</h1>
        <p className="mt-2 text-emerald-100">Kelola jadwal mengajar, absensi siswa, dan laporan perkembangan belajar.</p>
      </div>

      {/* Absensi harian — satu kali per hari */}
      <TutorDailyCheckIn
        todayLabel={todayLabel}
        initialCheckedIn={todayCheckIn?.isWithinRadius ?? false}
        initialCheckedInAt={todayCheckIn?.checkedInAt.toISOString()}
        initialDistanceM={todayCheckIn ? Math.round(todayCheckIn.distanceM) : undefined}
        hasScheduleToday={!!hasScheduleToday}
      />

      <AnnouncementsWidget />

      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">📅 Jadwal Mengajar</h2>
        {schedules.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
            <p className="text-3xl">📭</p>
            <p className="mt-2 text-sm">Tidak ada jadwal mengajar dalam 7 hari terakhir.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="rounded-2xl bg-white border border-slate-100 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-slate-800">{schedule.class.name}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[schedule.status]}`}>
                      {schedule.status}
                    </span>
                    {isNewlyPublished(schedule) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 animate-pulse">
                        🆕 Baru
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {new Date(schedule.date).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}{' '}
                    • {schedule.startTime}–{schedule.endTime}
                  </p>
                  {schedule.topic && (
                    <p className="text-sm text-indigo-600 font-medium mt-0.5">📚 {schedule.topic}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    {schedule.class._count.enrollments} siswa terdaftar
                  </p>
                  <TutorLocationEdit scheduleId={schedule.id} location={schedule.location} />
                  {schedule._count.participants > 0 && (
                    <p
                      className={`text-xs mt-1 font-medium ${
                        schedule._count.reports >= schedule._count.participants
                          ? 'text-emerald-600'
                          : 'text-orange-500'
                      }`}
                    >
                      📝 {schedule._count.reports}/{schedule._count.participants} laporan diisi
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/tutor/attendance/${schedule.id}`}
                    className="text-sm font-semibold px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                  >
                    ✏️ Absensi
                  </Link>
                  <Link
                    href={`/tutor/reports/${schedule.id}`}
                    className="text-sm font-semibold px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    📝 Laporan
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verifikasi TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: Tidak ada error.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/tutor/page.tsx
git commit -m "feat: add daily GPS check-in banner to tutor dashboard"
```

---

## Task 6: Admin Monitoring API

**Files:**
- Create: `app/api/admin/tutor-monitoring/route.ts`

- [ ] **Step 1: Buat API route**

Buat `app/api/admin/tutor-monitoring/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : defaultFrom
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : now

  const tutors = await prisma.user.findMany({
    where: { role: Role.TUTOR },
    select: {
      id: true,
      name: true,
      email: true,
      suspended: true,
      tutorCheckIns: {
        where: { checkedInAt: { gte: from, lte: to } },
        select: {
          id: true,
          date: true,
          checkedInAt: true,
          distanceM: true,
          isWithinRadius: true,
        },
        orderBy: { checkedInAt: 'desc' },
      },
      tutorClasses: {
        select: {
          schedules: {
            where: {
              date: { gte: from, lte: to },
              status: { in: ['PUBLISHED', 'COMPLETED'] },
            },
            select: { date: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const result = tutors.map((t) => {
    // Hitung hari unik yang ada jadwal
    const scheduleDates = new Set(
      t.tutorClasses
        .flatMap((c) => c.schedules)
        .map((s) => s.date.toISOString().slice(0, 10)),
    )
    const totalScheduleDays = scheduleDates.size

    // Hitung hari unik yang sudah absen valid
    const validCheckInDates = new Set(
      t.tutorCheckIns
        .filter((c) => c.isWithinRadius)
        .map((c) => c.date),
    )
    const totalValidDays = validCheckInDates.size

    const attendanceRate =
      totalScheduleDays > 0
        ? Math.round((totalValidDays / totalScheduleDays) * 100)
        : null

    const avgDistanceM =
      t.tutorCheckIns.length > 0
        ? Math.round(
            t.tutorCheckIns.reduce((sum, c) => sum + c.distanceM, 0) / t.tutorCheckIns.length,
          )
        : null

    return {
      id: t.id,
      name: t.name,
      email: t.email,
      suspended: t.suspended,
      totalScheduleDays,
      totalValidDays,
      attendanceRate,
      avgDistanceM,
      lastCheckIn: t.tutorCheckIns[0]?.checkedInAt.toISOString() ?? null,
      recentCheckIns: t.tutorCheckIns.slice(0, 7).map((c) => ({
        id: c.id,
        date: c.date,
        checkedInAt: c.checkedInAt.toISOString(),
        distanceM: Math.round(c.distanceM),
        isWithinRadius: c.isWithinRadius,
      })),
    }
  })

  return NextResponse.json(result)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/tutor-monitoring/route.ts
git commit -m "feat: add admin tutor monitoring API with daily check-in stats"
```

---

## Task 7: Admin Tutor Monitoring Page

**Files:**
- Create: `app/(dashboard)/admin/tutor-monitoring/page.tsx`
- Create: `app/(dashboard)/admin/tutor-monitoring/TutorMonitoringClient.tsx`
- Create: `app/(dashboard)/admin/tutor-monitoring/loading.tsx`

- [ ] **Step 1: Buat server page**

Buat `app/(dashboard)/admin/tutor-monitoring/page.tsx`:

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'
import TutorMonitoringClient from './TutorMonitoringClient'

export default async function TutorMonitoringPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/admin')

  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)

  const tutors = await prisma.user.findMany({
    where: { role: Role.TUTOR },
    select: {
      id: true,
      name: true,
      email: true,
      suspended: true,
      tutorCheckIns: {
        where: { checkedInAt: { gte: from } },
        select: {
          id: true,
          date: true,
          checkedInAt: true,
          distanceM: true,
          isWithinRadius: true,
        },
        orderBy: { checkedInAt: 'desc' },
      },
      tutorClasses: {
        select: {
          schedules: {
            where: {
              date: { gte: from },
              status: { in: ['PUBLISHED', 'COMPLETED'] },
            },
            select: { date: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const initialData = tutors.map((t) => {
    const scheduleDates = new Set(
      t.tutorClasses
        .flatMap((c) => c.schedules)
        .map((s) => s.date.toISOString().slice(0, 10)),
    )
    const totalScheduleDays = scheduleDates.size

    const validCheckInDates = new Set(
      t.tutorCheckIns.filter((c) => c.isWithinRadius).map((c) => c.date),
    )
    const totalValidDays = validCheckInDates.size

    const attendanceRate =
      totalScheduleDays > 0
        ? Math.round((totalValidDays / totalScheduleDays) * 100)
        : null

    const avgDistanceM =
      t.tutorCheckIns.length > 0
        ? Math.round(
            t.tutorCheckIns.reduce((sum, c) => sum + c.distanceM, 0) / t.tutorCheckIns.length,
          )
        : null

    return {
      id: t.id,
      name: t.name,
      email: t.email,
      suspended: t.suspended,
      totalScheduleDays,
      totalValidDays,
      attendanceRate,
      avgDistanceM,
      lastCheckIn: t.tutorCheckIns[0]?.checkedInAt.toISOString() ?? null,
      recentCheckIns: t.tutorCheckIns.slice(0, 7).map((c) => ({
        id: c.id,
        date: c.date,
        checkedInAt: c.checkedInAt.toISOString(),
        distanceM: Math.round(c.distanceM),
        isWithinRadius: c.isWithinRadius,
      })),
    }
  })

  return <TutorMonitoringClient initialData={initialData} />
}
```

- [ ] **Step 2: Buat loading skeleton**

Buat `app/(dashboard)/admin/tutor-monitoring/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="h-32 rounded-3xl bg-slate-200 animate-pulse" />
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Buat TutorMonitoringClient**

Buat `app/(dashboard)/admin/tutor-monitoring/TutorMonitoringClient.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { MapPin, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock } from 'lucide-react'

type CheckInRecord = {
  id: string
  date: string
  checkedInAt: string
  distanceM: number
  isWithinRadius: boolean
}

type TutorRow = {
  id: string
  name: string
  email: string
  suspended: boolean
  totalScheduleDays: number
  totalValidDays: number
  attendanceRate: number | null
  avgDistanceM: number | null
  lastCheckIn: string | null
  recentCheckIns: CheckInRecord[]
}

interface Props {
  initialData: TutorRow[]
}

function RateBadge({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-slate-400 text-sm">—</span>
  const cls =
    rate >= 80
      ? 'bg-emerald-100 text-emerald-700'
      : rate >= 50
        ? 'bg-amber-100 text-amber-700'
        : 'bg-rose-100 text-rose-600'
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{rate}%</span>
}

export default function TutorMonitoringClient({ initialData }: Props) {
  const [data] = useState<TutorRow[]>(initialData)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const filtered = data.filter(
    (t) =>
      t.name.toLowerCase().includes(filter.toLowerCase()) ||
      t.email.toLowerCase().includes(filter.toLowerCase()),
  )

  const totalTutors = data.length
  const activeTutors = data.filter((t) => !t.suspended).length
  const totalCheckInDays = data.reduce((s, t) => s + t.totalValidDays, 0)
  const avgRate =
    data.filter((t) => t.attendanceRate !== null).length > 0
      ? Math.round(
          data
            .filter((t) => t.attendanceRate !== null)
            .reduce((s, t) => s + t.attendanceRate!, 0) /
            data.filter((t) => t.attendanceRate !== null).length,
        )
      : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-teal-600 to-teal-800 p-8 text-white shadow-xl shadow-teal-600/10">
        <div className="flex items-center gap-3 mb-2">
          <MapPin className="h-7 w-7" />
          <h1 className="text-3xl font-extrabold tracking-tight">Monitoring Kehadiran Tutor</h1>
        </div>
        <p className="text-teal-100">
          Rekap absensi harian tutor bulan ini — satu absensi per hari per tutor.
          Radius wajib: 500m dari titik pusat bimbel.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {[
          { label: 'Total Tutor', value: totalTutors, sub: `${activeTutors} aktif` },
          { label: 'Hari Hadir (Bulan Ini)', value: totalCheckInDays, sub: 'total valid check-in' },
          {
            label: 'Rata-rata Kehadiran',
            value: avgRate !== null ? `${avgRate}%` : '—',
            sub: 'dari hari ada jadwal',
          },
          {
            label: 'Tutor Belum Absen',
            value: data.filter((t) => t.totalValidDays === 0).length,
            sub: 'bulan ini',
          },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-white border border-slate-100 shadow-xs p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
            <p className="text-2xl font-extrabold text-slate-800 mt-1">{card.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Cari nama atau email tutor..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 max-w-sm px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500"
        />
        <span className="text-sm text-slate-400">{filtered.length} tutor</span>
      </div>

      {/* Tutor List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
            <p className="text-3xl">🔍</p>
            <p className="mt-2 text-sm">Tidak ada tutor yang cocok.</p>
          </div>
        ) : (
          filtered.map((tutor) => {
            const isExpanded = expandedId === tutor.id
            return (
              <div
                key={tutor.id}
                className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : tutor.id)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm shrink-0">
                      {tutor.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-800">{tutor.name}</p>
                        {tutor.suspended && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">
                            SUSPEND
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{tutor.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 sm:gap-8 shrink-0">
                    <div className="hidden sm:flex flex-col items-end gap-0.5">
                      <p className="text-xs text-slate-400">Hari Jadwal</p>
                      <p className="text-sm font-bold text-slate-700">{tutor.totalScheduleDays}</p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-0.5">
                      <p className="text-xs text-slate-400">Hari Hadir</p>
                      <p className="text-sm font-bold text-slate-700">
                        {tutor.totalValidDays}/{tutor.totalScheduleDays}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <p className="text-xs text-slate-400">Rate</p>
                      <RateBadge rate={tutor.attendanceRate} />
                    </div>
                    <div className="hidden md:flex flex-col items-end gap-0.5">
                      <p className="text-xs text-slate-400">Avg Jarak</p>
                      <p className="text-sm font-medium text-slate-600">
                        {tutor.avgDistanceM !== null ? `${tutor.avgDistanceM}m` : '—'}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    {tutor.recentCheckIns.length === 0 ? (
                      <div className="px-6 py-6 text-center text-sm text-slate-400">
                        Belum ada data absensi bulan ini.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        <div className="px-6 py-2.5 flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Riwayat Absensi Terbaru
                          </p>
                        </div>
                        {tutor.recentCheckIns.map((ci) => {
                          const dateLabel = new Date(`${ci.date}T00:00:00+07:00`).toLocaleDateString(
                            'id-ID',
                            { weekday: 'short', day: 'numeric', month: 'short' },
                          )
                          const timeLabel = new Date(ci.checkedInAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                          return (
                            <div
                              key={ci.id}
                              className="px-6 py-3 flex items-center justify-between gap-4"
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-700">{dateLabel}</p>
                                <p className="text-xs text-slate-400">Absen pukul {timeLabel}</p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs text-slate-500">{ci.distanceM}m</span>
                                {ci.isWithinRadius ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-rose-500" />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Center Point Info */}
      <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 flex items-start gap-3">
        <MapPin className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-teal-800">Titik Pusat Absensi</p>
          <p className="text-xs text-teal-600 mt-0.5">
            Koordinat: -7.041736, 113.558258 • Radius: 500 meter • 1 absensi per hari per tutor
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verifikasi TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: Tidak ada error.

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/admin/tutor-monitoring/
git commit -m "feat: add admin tutor monitoring page with daily check-in stats"
```

---

## Task 8: Sidebar Navigation Update

**Files:**
- Modify: `components/dashboard/sidebar.tsx`

- [ ] **Step 1: Baca sidebar saat ini**

Baca `components/dashboard/sidebar.tsx`.

- [ ] **Step 2: Tambah icon dan menu item**

Tambahkan `UserCheck` ke import lucide-react yang sudah ada:
```tsx
import {
  // ... semua import yang sudah ada ...
  UserCheck,
} from 'lucide-react'
```

Di array nav SUPER_ADMIN, dalam group `'User'`, tambahkan setelah `{ name: 'Tutor', ... }`:
```tsx
{ name: 'Monitoring Tutor', href: '/admin/tutor-monitoring', icon: UserCheck },
```

Hasil group User:
```tsx
{
  name: 'User',
  icon: Users,
  subItems: [
    { name: 'Siswa', href: '/admin/students', icon: GraduationCap },
    { name: 'Tutor', href: '/admin/tutors', icon: Users },
    { name: 'Monitoring Tutor', href: '/admin/tutor-monitoring', icon: UserCheck },
    { name: 'Wali Murid / Parent', href: '/admin/parents', icon: UsersRound },
  ],
},
```

- [ ] **Step 3: Verifikasi dan test**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
npx jest --no-coverage 2>&1 | tail -10
```

Expected: Tidak ada error. All tests pass.

- [ ] **Step 4: Commit final**

```bash
git add components/dashboard/sidebar.tsx
git commit -m "feat: add Monitoring Tutor menu to admin sidebar"
```

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| Menu monitoring tutor di admin | Task 7 + Task 8 |
| Absen sekali per hari (bukan per jadwal) | Task 1, 3, 4, 5 |
| Validasi radius GPS 500m | Task 2 (lib/geolocation.ts) |
| Titik pusat -7.041736, 113.558258 | Task 2 |
| Tombol absen satu kali di atas dashboard | Task 4, 5 |
| Tidak bisa absen jika tidak ada jadwal hari itu | Task 3 (API validation) |
| Sudah absen → tombol hilang, tampil jam absen | Task 4 |
| Report harian di admin | Task 6 + Task 7 |

### Placeholder Scan

Tidak ada TBD, TODO, atau placeholder dalam kode di atas.

### Type Consistency

- `TutorCheckIn.date` adalah `String` di Prisma, dipakai sebagai key di semua bagian — konsisten
- `attendanceRate` adalah `number | null` di API dan Client type — konsisten
- `recentCheckIns` array type sama di Task 6 dan Task 7 — konsisten

---

## Laporan Skema

### Model TutorCheckIn (per hari)

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | String (cuid) | Primary key |
| `tutorId` | String | FK ke User (role=TUTOR) |
| `date` | String | Format "YYYY-MM-DD" (WIB/UTC+7) |
| `checkedInAt` | DateTime | Waktu persis saat klik absen |
| `latitude` | Float | Koordinat GPS tutor |
| `longitude` | Float | Koordinat GPS tutor |
| `distanceM` | Float | Jarak dari titik pusat (meter) |
| `isWithinRadius` | Boolean | True jika distanceM ≤ 500m |

**Constraint:** `@@unique([tutorId, date])` — satu absensi per tutor per hari

### Titik Pusat

```
Latitude:  -7.041736
Longitude: 113.558258
Radius:    500 meter
Formula:   Haversine (lib/geolocation.ts)
Timezone:  WIB (UTC+7) untuk penentuan "hari ini"
```

### Aturan Bisnis

| Aturan | Keterangan |
|---|---|
| 1 absen per hari | Jika sudah absen hari ini → tidak bisa absen lagi (upsert update) |
| Harus ada jadwal | API tolak jika tidak ada PUBLISHED/COMPLETED schedule hari ini |
| Berlaku semua jadwal | 1 absen berlaku untuk semua kelas yang diajar hari itu |
| Di luar radius | Absen tetap tersimpan tapi `isWithinRadius=false`, dianggap tidak hadir |

### API Endpoints

| Method | URL | Role | Keterangan |
|---|---|---|---|
| POST | `/api/tutor-checkin` | TUTOR | `{ latitude, longitude }` — absen hari ini |
| GET | `/api/tutor-checkin` | TUTOR | Status absen hari ini |
| GET | `/api/admin/tutor-monitoring` | SUPER_ADMIN | Stats semua tutor (filter `from`, `to`) |

### Halaman Baru

| URL | Role | Keterangan |
|---|---|---|
| `/admin/tutor-monitoring` | SUPER_ADMIN | Dashboard monitoring kehadiran harian tutor |
