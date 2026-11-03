# Absen per Jadwal + Kunci Laporan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tutor absen GPS sekali per jadwal (2 jadwal sehari = 2 absen), dan hanya bisa menulis laporan untuk jadwal yang sudah diabsen — kecuali Super Admin membukakan akses lewat permintaan dari tutor.

**Architecture:**
`TutorCheckIn` diberi `scheduleId` dan unik per `[tutorId, scheduleId]` (sebelumnya per `[tutorId, date]`). Aturan waktu dan aturan kunci laporan ditaruh di satu modul murni `lib/checkin-policy.ts`; satu helper server `getTutorReportAccess()` dipakai oleh semua jalur tulis laporan dan oleh UI. Jalan keluar saat tutor tidak bisa absen = model baru `ReportAccessRequest` (tutor mengajukan + alasan → Super Admin setujui/tolak di halaman Monitoring Tutor).

**Tech Stack:** Next.js 15 (App Router, route handlers), Prisma 6 + PostgreSQL, next-auth, zod, React 19, Tailwind, lucide-react, Jest (`testEnvironment: node`, tanpa React Testing Library).

---

## Keputusan yang sudah disepakati

| Topik | Aturan |
|---|---|
| Satuan absen | Per jadwal. Tiap jadwal hari ini punya tombol absen sendiri. |
| Jam absen | Dibuka 30 menit sebelum `startTime`, ditutup 23:59:59 WIB hari jadwal. Absen setelah `startTime` diterima, ditandai **terlambat**. |
| Lokasi | Semua sesi di bimbel. Radius tetap 500 m dari `CHECKIN_CENTER` (`lib/geolocation.ts`). |
| Kunci laporan | Role `TUTOR` hanya bisa menyimpan laporan jika: ada absen valid untuk jadwal itu, ATAU permintaan aksesnya `APPROVED`, ATAU jadwalnya sebelum `REPORT_GATE_FROM`. `ADMIN`/`SUPER_ADMIN` tidak dikunci. |
| Buka akses | Tutor mengisi alasan → status `PENDING` → Super Admin `APPROVED`/`REJECTED` (+ catatan). Ditolak → tutor boleh ajukan ulang. Akses yang disetujui TIDAK dihitung sebagai hadir di monitoring. |
| Jadwal lama | Jadwal dengan tanggal WIB < `REPORT_GATE_FROM` bebas kunci (belum ada absen per jadwal). |

## Amandemen (2026-10-11): radius 10 m + toleransi ketelitian GPS

Menggantikan baris "Lokasi … radius tetap 500 m" di tabel atas. Dikerjakan sebagai **Task 1A** (setelah Task 1), dan mengubah Task 2, 4, 5, 9 seperti di bawah.

Aturan: absen sah jika `jarak − toleransi ≤ 10 m`, dengan `toleransi = min(ketelitian yang dilaporkan HP, 30 m)`. Jadi batas terjauh praktis ±40 m. Ketelitian disimpan per absen supaya bisa diaudit.

**Task 1A — `lib/geolocation.ts` + `__tests__/lib/geolocation.test.ts`**

Di `lib/geolocation.ts` ganti `export const CHECKIN_RADIUS_METERS = 500` dan fungsi `checkRadius` dengan:

```ts
export const CHECKIN_RADIUS_METERS = 10
// GPS HP bisa meleset 5–50 m. Ketelitian yang dilaporkan HP ikut dihitung, tapi dibatasi
// supaya nilai ketelitian besar tidak melonggarkan radius tanpa batas.
export const CHECKIN_MAX_ACCURACY_ALLOWANCE_M = 30

export function checkRadius(
  lat: number,
  lng: number,
  accuracyM = 0,
): { isWithinRadius: boolean; distanceM: number } {
  const distanceM = haversineDistance(lat, lng, CHECKIN_CENTER.lat, CHECKIN_CENTER.lng)
  const allowance = Math.min(Math.max(accuracyM, 0), CHECKIN_MAX_ACCURACY_ALLOWANCE_M)
  return { isWithinRadius: distanceM - allowance <= CHECKIN_RADIUS_METERS, distanceM }
}
```

Di `__tests__/lib/geolocation.test.ts` ganti seluruh blok `describe('checkRadius', …)` dengan (dan tambah `CHECKIN_MAX_ACCURACY_ALLOWANCE_M` ke import):

```ts
describe('checkRadius', () => {
  // 0.0001° lintang ≈ 11,1 m
  const at = (latOffsetDeg: number, accuracyM?: number) =>
    checkRadius(CHECKIN_CENTER.lat + latOffsetDeg, CHECKIN_CENTER.lng, accuracyM)

  it('center point is within radius', () => {
    const result = at(0)
    expect(result.isWithinRadius).toBe(true)
    expect(result.distanceM).toBe(0)
  })

  it('radius is 10 m with a 30 m accuracy allowance cap', () => {
    expect(CHECKIN_RADIUS_METERS).toBe(10)
    expect(CHECKIN_MAX_ACCURACY_ALLOWANCE_M).toBe(30)
  })

  it('rejects a point ~11 m away when no accuracy is reported', () => {
    expect(at(0.0001).isWithinRadius).toBe(false)
  })

  it('accepts a point ~11 m away when GPS accuracy is 5 m', () => {
    expect(at(0.0001, 5).isWithinRadius).toBe(true)
  })

  it('accepts a point ~33 m away when GPS accuracy is 30 m', () => {
    expect(at(0.0003, 30).isWithinRadius).toBe(true)
  })

  it('caps the allowance: ~44 m away is rejected even with 100 m accuracy', () => {
    expect(at(0.0004, 100).isWithinRadius).toBe(false)
  })

  it('ignores negative accuracy', () => {
    expect(at(0.0001, -50).isWithinRadius).toBe(false)
  })

  it('reports the true distance, not the adjusted one', () => {
    const d = at(0.0003, 30).distanceM
    expect(d).toBeGreaterThan(30)
    expect(d).toBeLessThan(37)
  })
})
```

TDD: tulis test dulu → `npx jest __tests__/lib/geolocation.test.ts` FAIL → ubah lib → PASS. Commit: `feat(checkin): 10 m radius with capped GPS accuracy allowance`.

**Task 2 — schema:** di model `TutorCheckIn` tambah baris `accuracyM      Float?` setelah `distanceM`. SQL migrasi akan memuat `ADD COLUMN "accuracyM" DOUBLE PRECISION`.

**Task 4 — route `POST /api/tutor-checkin`:**
- Ambil `accuracy` dari body: `const { latitude, longitude, scheduleId, accuracy } = await req.json()` lalu `const accuracyM = typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : 0`.
- `checkRadius(latitude, longitude, accuracyM)`; simpan `accuracyM` di `update` dan `create`.
- Pesan luar radius: `` `Anda terbaca ${distanceM}m dari titik absen (maksimal ${CHECKIN_RADIUS_METERS}m). Coba lagi di dekat jendela atau di luar ruangan supaya GPS lebih akurat.` ``
- Test tambahan di `__tests__/api/tutor-checkin.test.ts`:

```ts
  it('accepts a nearby point when the reported GPS accuracy covers the gap', async () => {
    const near = { latitude: CHECKIN_CENTER.lat + 0.0002, longitude: CHECKIN_CENTER.lng } // ≈ 22 m
    expect((await POST(makeReq({ scheduleId: 's1', ...near }))).status).toBe(422)
    const res = await POST(makeReq({ scheduleId: 's1', ...near, accuracy: 20 }))
    expect(res.status).toBe(200)
    expect(prisma.tutorCheckIn.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ accuracyM: 20, isWithinRadius: true }) }),
    )
  })
```

(Expected jumlah test Task 4 jadi 10.)

**Task 5 — komponen:** kirim `accuracy: pos.coords.accuracy` di body `fetch('/api/tutor-checkin')`. Ganti teks `📍 Absensi hanya berlaku dalam radius 500m dari lokasi bimbel.` dengan `📍 Absensi hanya berlaku di lokasi bimbel (radius {CHECKIN_RADIUS_METERS}m dari titik absen).` dan import `CHECKIN_RADIUS_METERS` dari `@/lib/geolocation`.

**Task 9 — monitoring:** di `TutorMonitoringClient.tsx` import `CHECKIN_RADIUS_METERS, CHECKIN_MAX_ACCURACY_ALLOWANCE_M` dari `@/lib/geolocation`; ganti `Radius wajib: 500m dari titik pusat bimbel.` → `Radius wajib: {CHECKIN_RADIUS_METERS}m dari titik absen (toleransi ketelitian GPS maks. {CHECKIN_MAX_ACCURACY_ALLOWANCE_M}m).` dan di footer `Radius: 500 meter` → `Radius: {CHECKIN_RADIUS_METERS} meter (+ toleransi GPS maks. {CHECKIN_MAX_ACCURACY_ALLOWANCE_M} m)`.

**Task 10 — tes manual:** lokasi "luar radius" tetap `-7.035736, 113.558258`. Tambah cek di lokasi nyata: absen dari dalam ruang kelas terjauh dari titik; kalau ditolak, titik `CHECKIN_CENTER` perlu digeser ke tengah gedung.

## Fakta kode yang perlu diketahui

- `Schedule.date` disimpan sebagai `new Date('YYYY-MM-DD')` = 00:00 UTC = 07:00 WIB. `Schedule.startTime` string `"HH:MM"`.
- Laporan disimpan lewat `POST /api/reports` (dipakai UI, upsert → juga dipakai untuk edit). Ada jalur kedua `POST /api/schedules/[id]/reports` (tidak dipakai UI, tapi aktif) — keduanya harus dikunci.
- `components/reports/ReportInputClient.tsx` dipakai tutor DAN admin (`app/(dashboard)/admin/reports/[scheduleId]/page.tsx`).
- `GET /api/tutor-checkin` tidak dipakai siapa pun → dihapus.
- Folder `.claude/worktrees/` berisi salinan repo; jest ikut memindainya. Selalu jalankan suite penuh dengan `--testPathIgnorePatterns ".claude/worktrees"`.
- `rtk` tidak terpasang di Git Bash mesin ini → perintah di bawah ditulis polos. Kalau `rtk` tersedia di shell-mu, beri prefix `rtk`.
- Pola test API: lihat `__tests__/api/expenses.test.ts` (mock `next-auth`, `@/lib/auth`, `@/lib/db`).

## File Structure

| File | Aksi | Tanggung jawab |
|---|---|---|
| `lib/checkin-policy.ts` | Create | Aturan murni: hari WIB jadwal, jam buka/tutup absen, terlambat, keputusan akses laporan |
| `prisma/schema.prisma` | Modify | `TutorCheckIn.scheduleId`, model `ReportAccessRequest`, enum `ReportAccessStatus` |
| `prisma/migrations/<ts>_per_schedule_checkin_report_access/migration.sql` | Create (generated) | Migrasi DB |
| `lib/report-access.ts` | Create | `getTutorReportAccess()` — baca DB, panggil policy |
| `app/api/tutor-checkin/route.ts` | Modify | `POST` absen per jadwal; hapus `GET` |
| `components/dashboard/TutorDailyCheckIn.tsx` | Modify (rewrite) | Kartu absen: satu baris per jadwal hari ini |
| `app/(dashboard)/tutor/page.tsx` | Modify | Query jadwal + absen hari ini, kirim ke komponen |
| `app/api/reports/route.ts` | Modify | Kunci `POST` untuk TUTOR |
| `app/api/schedules/[id]/reports/route.ts` | Modify | Kunci `POST` untuk TUTOR |
| `app/api/report-access/route.ts` | Create | Tutor: `GET` status akses, `POST` ajukan akses |
| `app/api/admin/report-access/[id]/route.ts` | Create | Super Admin: `PATCH` setujui/tolak |
| `components/reports/ReportAccessLock.tsx` | Create | Panel "laporan terkunci" + form permintaan akses |
| `components/reports/ReportInputClient.tsx` | Modify | Tampilkan panel kunci, tampilkan pesan error server |
| `lib/tutor-monitoring.ts` | Create | `summarizeTutorAttendance()` — statistik per sesi (dipakai page + API) |
| `app/(dashboard)/admin/tutor-monitoring/page.tsx` | Modify | Pakai summarizer, muat permintaan akses |
| `app/api/admin/tutor-monitoring/route.ts` | Modify | Pakai summarizer |
| `app/(dashboard)/admin/tutor-monitoring/TutorMonitoringClient.tsx` | Modify | Label per sesi, kolom terlambat, panel permintaan |
| `app/(dashboard)/admin/tutor-monitoring/ReportAccessRequestsPanel.tsx` | Create | Daftar permintaan + tombol Setujui/Tolak |
| `__tests__/lib/checkin-policy.test.ts` | Create | Test policy |
| `__tests__/lib/report-access.test.ts` | Create | Test helper akses |
| `__tests__/lib/tutor-monitoring.test.ts` | Create | Test summarizer |
| `__tests__/api/tutor-checkin.test.ts` | Create | Test route absen |
| `__tests__/api/reports-checkin-gate.test.ts` | Create | Test kunci laporan |
| `__tests__/api/report-access.test.ts` | Create | Test ajukan + putuskan akses |

Catatan urutan: setelah Task 2 (schema), `tsc` akan error di `app/api/tutor-checkin/route.ts` dan `app/(dashboard)/tutor/page.tsx` (masih pakai `tutorId_date`) sampai Task 4 dan 5 selesai. Itu diharapkan.

---

### Task 1: Modul aturan `lib/checkin-policy.ts`

**Files:**
- Create: `lib/checkin-policy.ts`
- Test: `__tests__/lib/checkin-policy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/checkin-policy.test.ts`:

```ts
import {
  REPORT_GATE_FROM,
  scheduleDayWIB,
  scheduleStartAt,
  checkInOpensAt,
  checkInWindow,
  isLateCheckIn,
  decideReportAccess,
} from '@/lib/checkin-policy'

// Schedule.date disimpan sebagai 00:00 UTC = 07:00 WIB di hari yang sama
const date = new Date('2026-10-20')

describe('scheduleDayWIB', () => {
  it('returns the WIB calendar day of a schedule stored at UTC midnight', () => {
    expect(scheduleDayWIB(date)).toBe('2026-10-20')
  })

  it('treats 17:00 UTC of the previous day as the next WIB day', () => {
    expect(scheduleDayWIB(new Date('2026-10-19T17:00:00Z'))).toBe('2026-10-20')
  })
})

describe('scheduleStartAt', () => {
  it('combines WIB day and HH:MM start time', () => {
    expect(scheduleStartAt(date, '15:00').toISOString()).toBe('2026-10-20T08:00:00.000Z')
  })

  it('pads single-digit hours', () => {
    expect(scheduleStartAt(date, '9:00').toISOString()).toBe('2026-10-20T02:00:00.000Z')
  })

  it('falls back to start of the WIB day when startTime is unparseable', () => {
    expect(scheduleStartAt(date, 'abc').toISOString()).toBe('2026-10-19T17:00:00.000Z')
  })
})

describe('checkInWindow', () => {
  it('opens 30 minutes before start', () => {
    expect(checkInOpensAt(date, '15:00').toISOString()).toBe('2026-10-20T07:30:00.000Z')
  })

  it('is not-open one second before opening', () => {
    expect(checkInWindow(date, '15:00', new Date('2026-10-20T07:29:59Z'))).toBe('not-open')
  })

  it('is open exactly at opening time', () => {
    expect(checkInWindow(date, '15:00', new Date('2026-10-20T07:30:00Z'))).toBe('open')
  })

  it('stays open until 23:59:59 WIB of the schedule day', () => {
    expect(checkInWindow(date, '15:00', new Date('2026-10-20T16:59:59Z'))).toBe('open')
  })

  it('is closed at 00:00 WIB of the next day', () => {
    expect(checkInWindow(date, '15:00', new Date('2026-10-20T17:00:00Z'))).toBe('closed')
  })
})

describe('isLateCheckIn', () => {
  it('is not late exactly at start time', () => {
    expect(isLateCheckIn(date, '15:00', new Date('2026-10-20T08:00:00Z'))).toBe(false)
  })

  it('is late one second after start time', () => {
    expect(isLateCheckIn(date, '15:00', new Date('2026-10-20T08:00:01Z'))).toBe(true)
  })
})

describe('decideReportAccess', () => {
  const gated = new Date(REPORT_GATE_FROM)
  const beforeGate = new Date(gated.getTime() - 24 * 60 * 60 * 1000)

  it('exempts schedules before the gate date', () => {
    expect(
      decideReportAccess({ scheduleDate: beforeGate, hasValidCheckIn: false, requestStatus: null }),
    ).toEqual({ allowed: true, reason: 'exempt' })
  })

  it('allows when tutor has a valid check-in', () => {
    expect(
      decideReportAccess({ scheduleDate: gated, hasValidCheckIn: true, requestStatus: null }),
    ).toEqual({ allowed: true, reason: 'checked-in' })
  })

  it('allows when the access request is approved', () => {
    expect(
      decideReportAccess({ scheduleDate: gated, hasValidCheckIn: false, requestStatus: 'APPROVED' }),
    ).toEqual({ allowed: true, reason: 'approved' })
  })

  it.each([null, 'PENDING', 'REJECTED'] as const)('blocks without check-in when request is %s', (requestStatus) => {
    expect(
      decideReportAccess({ scheduleDate: gated, hasValidCheckIn: false, requestStatus }),
    ).toEqual({ allowed: false, reason: 'no-checkin' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/checkin-policy.test.ts`
Expected: FAIL — `Cannot find module '@/lib/checkin-policy'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/checkin-policy.ts`:

```ts
export const CHECKIN_OPENS_MINUTES_BEFORE = 30

// Jadwal dengan tanggal WIB sebelum ini bebas dari kunci laporan (belum ada absen per jadwal).
// Nilai awal = tanggal plan dibuat supaya kunci bisa dites lokal; diubah ke tanggal deploy di Task 10.
export const REPORT_GATE_FROM = '2026-10-11'

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

export type CheckInWindow = 'not-open' | 'open' | 'closed'
export type ReportAccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type ReportAccessReason = 'exempt' | 'checked-in' | 'approved' | 'no-checkin'

export function scheduleDayWIB(date: Date): string {
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10)
}

export function scheduleStartAt(date: Date, startTime: string): Date {
  const day = scheduleDayWIB(date)
  const start = new Date(`${day}T${startTime.padStart(5, '0')}:00+07:00`)
  // ponytail: startTime rusak → anggap mulai 00:00 WIB supaya tutor tidak terkunci oleh data jelek.
  return Number.isNaN(start.getTime()) ? new Date(`${day}T00:00:00+07:00`) : start
}

export function checkInOpensAt(date: Date, startTime: string): Date {
  return new Date(scheduleStartAt(date, startTime).getTime() - CHECKIN_OPENS_MINUTES_BEFORE * 60 * 1000)
}

export function checkInWindow(date: Date, startTime: string, now: Date = new Date()): CheckInWindow {
  if (now < checkInOpensAt(date, startTime)) return 'not-open'
  const closesAt = new Date(`${scheduleDayWIB(date)}T23:59:59.999+07:00`)
  return now <= closesAt ? 'open' : 'closed'
}

export function isLateCheckIn(date: Date, startTime: string, checkedInAt: Date): boolean {
  return checkedInAt > scheduleStartAt(date, startTime)
}

export function decideReportAccess(input: {
  scheduleDate: Date
  hasValidCheckIn: boolean
  requestStatus: ReportAccessRequestStatus | null
}): { allowed: boolean; reason: ReportAccessReason } {
  if (scheduleDayWIB(input.scheduleDate) < REPORT_GATE_FROM) return { allowed: true, reason: 'exempt' }
  if (input.hasValidCheckIn) return { allowed: true, reason: 'checked-in' }
  if (input.requestStatus === 'APPROVED') return { allowed: true, reason: 'approved' }
  return { allowed: false, reason: 'no-checkin' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/checkin-policy.test.ts`
Expected: PASS (18 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/checkin-policy.ts __tests__/lib/checkin-policy.test.ts
git commit -m "feat(checkin): add per-schedule check-in and report gate policy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

### Task 2: Schema + migrasi

**Files:**
- Modify: `prisma/schema.prisma` (model `User` ~baris 14-32, `Schedule` ~133-154, `TutorCheckIn` ~169-181, enum di akhir file)
- Create (generated): `prisma/migrations/<timestamp>_per_schedule_checkin_report_access/migration.sql`

- [ ] **Step 1: Tambah relasi di model `User`**

Di model `User`, setelah baris `tutorCheckIns          TutorCheckIn[]       @relation("TutorCheckIns")` tambah:

```prisma
  reportAccessRequests   ReportAccessRequest[] @relation("ReportAccessRequester")
  reportAccessDecisions  ReportAccessRequest[] @relation("ReportAccessDecider")
```

- [ ] **Step 2: Tambah relasi di model `Schedule`**

Di model `Schedule`, setelah baris `participants      ScheduleParticipant[]` tambah:

```prisma
  tutorCheckIns        TutorCheckIn[]
  reportAccessRequests ReportAccessRequest[]
```

- [ ] **Step 3: Ganti model `TutorCheckIn`**

Ganti seluruh blok `model TutorCheckIn { ... }` dengan:

```prisma
model TutorCheckIn {
  id             String    @id @default(cuid())
  tutorId        String
  scheduleId     String?
  date           String
  checkedInAt    DateTime  @default(now())
  latitude       Float
  longitude      Float
  distanceM      Float
  isWithinRadius Boolean
  tutor          User      @relation("TutorCheckIns", fields: [tutorId], references: [id])
  schedule       Schedule? @relation(fields: [scheduleId], references: [id], onDelete: SetNull)

  @@unique([tutorId, scheduleId])
  @@index([tutorId, date])
}

model ReportAccessRequest {
  id          String             @id @default(cuid())
  tutorId     String
  scheduleId  String
  reason      String
  status      ReportAccessStatus @default(PENDING)
  adminNote   String?
  createdAt   DateTime           @default(now())
  decidedAt   DateTime?
  decidedById String?
  tutor       User               @relation("ReportAccessRequester", fields: [tutorId], references: [id])
  schedule    Schedule           @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  decidedBy   User?              @relation("ReportAccessDecider", fields: [decidedById], references: [id])

  @@unique([tutorId, scheduleId])
  @@index([status])
}
```

`scheduleId` nullable karena baris absen lama (per hari) tidak punya jadwal; baris itu tetap disimpan sebagai riwayat.

- [ ] **Step 4: Tambah enum**

Setelah blok `enum AttendanceStatus { ... }` tambah:

```prisma
enum ReportAccessStatus {
  PENDING
  APPROVED
  REJECTED
}
```

- [ ] **Step 5: Generate migrasi**

Pastikan database lokal jalan (`docker compose up -d` jika pakai `docker-compose.yml`), lalu:

Run: `npx prisma migrate dev --name per_schedule_checkin_report_access`
Expected: folder migrasi baru dibuat, `Your database is now in sync with your schema`, Prisma Client ter-generate.

- [ ] **Step 6: Periksa SQL migrasi**

Buka `prisma/migrations/*_per_schedule_checkin_report_access/migration.sql`. Harus berisi (urutan boleh beda) dan TIDAK boleh ada `DROP TABLE` / `DROP COLUMN`:

```sql
CREATE TYPE "ReportAccessStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
DROP INDEX "TutorCheckIn_tutorId_date_key";
ALTER TABLE "TutorCheckIn" ADD COLUMN "scheduleId" TEXT;
CREATE TABLE "ReportAccessRequest" ( ... );
CREATE UNIQUE INDEX "ReportAccessRequest_tutorId_scheduleId_key" ON "ReportAccessRequest"("tutorId", "scheduleId");
CREATE INDEX "ReportAccessRequest_status_idx" ON "ReportAccessRequest"("status");
CREATE INDEX "TutorCheckIn_tutorId_date_idx" ON "TutorCheckIn"("tutorId", "date");
CREATE UNIQUE INDEX "TutorCheckIn_tutorId_scheduleId_key" ON "TutorCheckIn"("tutorId", "scheduleId");
ALTER TABLE "TutorCheckIn" ADD CONSTRAINT "TutorCheckIn_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReportAccessRequest" ADD CONSTRAINT "ReportAccessRequest_tutorId_fkey" ...;
ALTER TABLE "ReportAccessRequest" ADD CONSTRAINT "ReportAccessRequest_scheduleId_fkey" ... ON DELETE CASCADE ...;
ALTER TABLE "ReportAccessRequest" ADD CONSTRAINT "ReportAccessRequest_decidedById_fkey" ... ON DELETE SET NULL ...;
```

Jika ada statement yang menghapus data → STOP, lapor BLOCKED.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): per-schedule tutor check-in and report access requests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + model/enum yang kena + ringkas perubahan (1-3 kalimat).

---

### Task 3: Helper `getTutorReportAccess`

**Files:**
- Create: `lib/report-access.ts`
- Test: `__tests__/lib/report-access.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/report-access.test.ts`:

```ts
import { getTutorReportAccess } from '@/lib/report-access'
import { prisma } from '@/lib/db'
import { REPORT_GATE_FROM } from '@/lib/checkin-policy'

jest.mock('@/lib/db', () => ({
  prisma: {
    schedule: { findUnique: jest.fn() },
    tutorCheckIn: { findUnique: jest.fn() },
    reportAccessRequest: { findUnique: jest.fn() },
  },
}))

const gatedSchedule = { date: new Date(REPORT_GATE_FROM), startTime: '15:00' }

describe('getTutorReportAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.schedule.findUnique as jest.Mock).mockResolvedValue(gatedSchedule)
    ;(prisma.tutorCheckIn.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.reportAccessRequest.findUnique as jest.Mock).mockResolvedValue(null)
  })

  it('reports schedule-not-found when schedule does not exist', async () => {
    ;(prisma.schedule.findUnique as jest.Mock).mockResolvedValue(null)
    expect(await getTutorReportAccess('t1', 's1')).toEqual({
      allowed: false,
      reason: 'schedule-not-found',
      checkInWindow: null,
      request: null,
    })
  })

  it('looks up check-in and request by tutor + schedule', async () => {
    await getTutorReportAccess('t1', 's1')
    const where = { tutorId_scheduleId: { tutorId: 't1', scheduleId: 's1' } }
    expect(prisma.tutorCheckIn.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where }))
    expect(prisma.reportAccessRequest.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where }))
  })

  it('blocks when there is no check-in and no request', async () => {
    const access = await getTutorReportAccess('t1', 's1')
    expect(access.allowed).toBe(false)
    expect(access.reason).toBe('no-checkin')
  })

  it('blocks when the only check-in is outside the radius', async () => {
    ;(prisma.tutorCheckIn.findUnique as jest.Mock).mockResolvedValue({ isWithinRadius: false })
    expect((await getTutorReportAccess('t1', 's1')).allowed).toBe(false)
  })

  it('allows with a valid check-in', async () => {
    ;(prisma.tutorCheckIn.findUnique as jest.Mock).mockResolvedValue({ isWithinRadius: true })
    const access = await getTutorReportAccess('t1', 's1')
    expect(access).toMatchObject({ allowed: true, reason: 'checked-in' })
  })

  it('allows with an approved request and returns the request', async () => {
    const request = { id: 'r1', status: 'APPROVED', reason: 'GPS rusak', adminNote: null }
    ;(prisma.reportAccessRequest.findUnique as jest.Mock).mockResolvedValue(request)
    const access = await getTutorReportAccess('t1', 's1')
    expect(access).toMatchObject({ allowed: true, reason: 'approved', request })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/report-access.test.ts`
Expected: FAIL — `Cannot find module '@/lib/report-access'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/report-access.ts`:

```ts
import { prisma } from '@/lib/db'
import {
  checkInWindow,
  decideReportAccess,
  type CheckInWindow,
  type ReportAccessReason,
  type ReportAccessRequestStatus,
} from '@/lib/checkin-policy'

export type TutorReportAccess = {
  allowed: boolean
  reason: ReportAccessReason | 'schedule-not-found'
  checkInWindow: CheckInWindow | null
  request: {
    id: string
    status: ReportAccessRequestStatus
    reason: string
    adminNote: string | null
  } | null
}

export async function getTutorReportAccess(tutorId: string, scheduleId: string): Promise<TutorReportAccess> {
  const where = { tutorId_scheduleId: { tutorId, scheduleId } }
  const [schedule, checkIn, request] = await Promise.all([
    prisma.schedule.findUnique({ where: { id: scheduleId }, select: { date: true, startTime: true } }),
    prisma.tutorCheckIn.findUnique({ where, select: { isWithinRadius: true } }),
    prisma.reportAccessRequest.findUnique({
      where,
      select: { id: true, status: true, reason: true, adminNote: true },
    }),
  ])

  if (!schedule) return { allowed: false, reason: 'schedule-not-found', checkInWindow: null, request: null }

  const decision = decideReportAccess({
    scheduleDate: schedule.date,
    hasValidCheckIn: checkIn?.isWithinRadius ?? false,
    requestStatus: request?.status ?? null,
  })

  return { ...decision, checkInWindow: checkInWindow(schedule.date, schedule.startTime), request }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/report-access.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/report-access.ts __tests__/lib/report-access.test.ts
git commit -m "feat(reports): add getTutorReportAccess helper

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

### Task 4: `POST /api/tutor-checkin` per jadwal

**Files:**
- Modify: `app/api/tutor-checkin/route.ts` (ganti seluruh isi)
- Test: `__tests__/api/tutor-checkin.test.ts`

Perilaku:
- Body `{ scheduleId, latitude, longitude }`.
- Jadwal harus milik tutor (tutor utama atau tambahan) dan berstatus `PUBLISHED`/`COMPLETED` → kalau tidak, 404.
- Jendela waktu: `not-open` → 422; `closed` → 422.
- Sudah ada absen valid untuk jadwal itu → kembalikan yang lama, JANGAN ditimpa (tap ulang dari luar radius tidak boleh membatalkan absen sah).
- Selain itu upsert per `[tutorId, scheduleId]`.
- `GET` dihapus (tidak ada pemakai).

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/tutor-checkin.test.ts`:

```ts
import { POST } from '@/app/api/tutor-checkin/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'
import { checkInWindow } from '@/lib/checkin-policy'
import { CHECKIN_CENTER } from '@/lib/geolocation'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    schedule: { findFirst: jest.fn() },
    tutorCheckIn: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}))
jest.mock('@/lib/checkin-policy', () => ({
  ...jest.requireActual('@/lib/checkin-policy'),
  checkInWindow: jest.fn(),
}))

const makeReq = (body: object) =>
  new NextRequest('http://localhost/api/tutor-checkin', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

const inside = { latitude: CHECKIN_CENTER.lat, longitude: CHECKIN_CENTER.lng }
const outside = { latitude: -7.035736, longitude: 113.558258 }
const schedule = { id: 's1', date: new Date('2026-10-20'), startTime: '15:00' }

describe('POST /api/tutor-checkin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 't1', role: 'TUTOR' } })
    ;(prisma.schedule.findFirst as jest.Mock).mockResolvedValue(schedule)
    ;(prisma.tutorCheckIn.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.tutorCheckIn.upsert as jest.Mock).mockImplementation(async ({ create }) => ({
      ...create,
      checkedInAt: new Date('2026-10-20T07:45:00Z'),
    }))
    ;(checkInWindow as jest.Mock).mockReturnValue('open')
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    expect((await POST(makeReq({ scheduleId: 's1', ...inside }))).status).toBe(401)
  })

  it('returns 403 for non-tutor', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } })
    expect((await POST(makeReq({ scheduleId: 's1', ...inside }))).status).toBe(403)
  })

  it('returns 400 when scheduleId is missing', async () => {
    expect((await POST(makeReq(inside))).status).toBe(400)
  })

  it('returns 404 when the schedule is not one of the tutor’s published schedules', async () => {
    ;(prisma.schedule.findFirst as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ scheduleId: 's1', ...inside }))
    expect(res.status).toBe(404)
    expect(prisma.schedule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 's1',
          OR: [
            { class: { tutorId: 't1' } },
            { class: { additionalTutors: { some: { tutorId: 't1' } } } },
          ],
        }),
      }),
    )
  })

  it.each(['not-open', 'closed'])('returns 422 and writes nothing when window is %s', async (window) => {
    ;(checkInWindow as jest.Mock).mockReturnValue(window)
    const res = await POST(makeReq({ scheduleId: 's1', ...inside }))
    expect(res.status).toBe(422)
    expect(prisma.tutorCheckIn.upsert).not.toHaveBeenCalled()
  })

  it('creates a check-in tied to the schedule and its WIB day', async () => {
    const res = await POST(makeReq({ scheduleId: 's1', ...inside }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toMatchObject({ success: true, isWithinRadius: true, scheduleId: 's1', late: false })
    expect(prisma.tutorCheckIn.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tutorId_scheduleId: { tutorId: 't1', scheduleId: 's1' } },
        create: expect.objectContaining({ tutorId: 't1', scheduleId: 's1', date: '2026-10-20', isWithinRadius: true }),
      }),
    )
  })

  it('returns 422 with isWithinRadius false when outside the radius', async () => {
    const res = await POST(makeReq({ scheduleId: 's1', ...outside }))
    const data = await res.json()
    expect(res.status).toBe(422)
    expect(data.isWithinRadius).toBe(false)
  })

  it('does not overwrite an existing valid check-in', async () => {
    ;(prisma.tutorCheckIn.findUnique as jest.Mock).mockResolvedValue({
      isWithinRadius: true,
      distanceM: 12.4,
      checkedInAt: new Date('2026-10-20T07:40:00Z'),
    })
    const res = await POST(makeReq({ scheduleId: 's1', ...outside }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toMatchObject({ success: true, isWithinRadius: true, distanceM: 12 })
    expect(prisma.tutorCheckIn.upsert).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/tutor-checkin.test.ts`
Expected: FAIL — beberapa test gagal (route lama tidak mengenal `scheduleId`, memakai `tutorId_date`).

- [ ] **Step 3: Write implementation**

Ganti seluruh isi `app/api/tutor-checkin/route.ts` dengan:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkRadius, CHECKIN_RADIUS_METERS } from '@/lib/geolocation'
import {
  CHECKIN_OPENS_MINUTES_BEFORE,
  checkInWindow,
  isLateCheckIn,
  scheduleDayWIB,
} from '@/lib/checkin-policy'

function fail(message: string, status: number) {
  return NextResponse.json({ error: message, message }, { status })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tutorId = (session.user as any).id
  const { latitude, longitude, scheduleId } = await req.json()

  if (typeof scheduleId !== 'string' || !scheduleId) {
    return fail('scheduleId wajib diisi', 400)
  }
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return fail('latitude dan longitude wajib diisi', 400)
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return fail('Koordinat GPS tidak valid', 400)
  }

  const schedule = await prisma.schedule.findFirst({
    where: {
      id: scheduleId,
      status: { in: ['PUBLISHED', 'COMPLETED'] },
      OR: [
        { class: { tutorId } },
        { class: { additionalTutors: { some: { tutorId } } } },
      ],
    },
    select: { id: true, date: true, startTime: true },
  })
  if (!schedule) return fail('Jadwal tidak ditemukan atau bukan jadwal Anda.', 404)

  const window = checkInWindow(schedule.date, schedule.startTime)
  if (window === 'not-open') {
    return fail(
      `Absen dibuka ${CHECKIN_OPENS_MINUTES_BEFORE} menit sebelum sesi mulai (${schedule.startTime}).`,
      422,
    )
  }
  if (window === 'closed') {
    return fail('Waktu absen untuk jadwal ini sudah lewat. Ajukan akses laporan ke Super Admin.', 422)
  }

  const where = { tutorId_scheduleId: { tutorId, scheduleId } }
  const existing = await prisma.tutorCheckIn.findUnique({ where })

  // Absen sah tidak boleh ditimpa oleh tap ulang (mis. dari luar radius).
  const checkIn = existing?.isWithinRadius
    ? existing
    : await (async () => {
        const { isWithinRadius, distanceM } = checkRadius(latitude, longitude)
        return prisma.tutorCheckIn.upsert({
          where,
          update: { latitude, longitude, distanceM, isWithinRadius, checkedInAt: new Date() },
          create: {
            tutorId,
            scheduleId,
            date: scheduleDayWIB(schedule.date),
            latitude,
            longitude,
            distanceM,
            isWithinRadius,
          },
        })
      })()

  const distanceM = Math.round(checkIn.distanceM)

  if (!checkIn.isWithinRadius) {
    return NextResponse.json(
      {
        success: false,
        isWithinRadius: false,
        scheduleId,
        distanceM,
        message: `Anda berada ${distanceM}m dari lokasi bimbel. Maksimal ${CHECKIN_RADIUS_METERS}m.`,
      },
      { status: 422 },
    )
  }

  return NextResponse.json({
    success: true,
    isWithinRadius: true,
    scheduleId,
    distanceM,
    checkedInAt: checkIn.checkedInAt.toISOString(),
    late: isLateCheckIn(schedule.date, schedule.startTime, checkIn.checkedInAt),
    message: `Absen berhasil! Jarak: ${distanceM}m`,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/api/tutor-checkin.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/tutor-checkin/route.ts __tests__/api/tutor-checkin.test.ts
git commit -m "feat(checkin): check in per schedule with time window

Opens 30 minutes before the session, closes at end of day. A valid
check-in is never overwritten. Removes the unused GET handler.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

### Task 5: Dashboard tutor — kartu absen per jadwal

**Files:**
- Modify (rewrite): `components/dashboard/TutorDailyCheckIn.tsx`
- Modify: `app/(dashboard)/tutor/page.tsx` (import baris 8-9, query baris 16-48, pemakaian komponen baris 75-83)

Tidak ada React Testing Library → verifikasi lewat `tsc`, `eslint`, dan cek manual (Task 10). Logika waktu sudah dites di Task 1; server tetap jadi penentu (Task 4).

- [ ] **Step 1: Rewrite komponen**

Ganti seluruh isi `components/dashboard/TutorDailyCheckIn.tsx` dengan:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { MapPin, CheckCircle2, AlertTriangle, Loader2, X, CalendarCheck, ShieldAlert, Clock } from 'lucide-react'
import { getLocationPermission, type LocationPermission } from '@/lib/location-permission'

const DENIED_MSG = 'Izin lokasi diblokir. Buka izin lokasi untuk situs ini, lalu tekan "Coba Lagi".'

export interface CheckInScheduleItem {
  scheduleId: string
  className: string
  startTime: string
  endTime: string
  opensAt: string
  startsAt: string
  checkedInAt: string | null
  distanceM: number | null
}

interface Props {
  todayLabel: string
  todayDateKey: string
  schedules: CheckInScheduleItem[]
}

type RowStatus = 'idle' | 'locating' | 'sending' | 'success' | 'outside' | 'error'

interface RowState {
  status: RowStatus
  checkedInAt: string | null
  distanceM: number | null
  errorMsg: string | null
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

export function TutorDailyCheckIn({ todayLabel, todayDateKey, schedules }: Props) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      schedules.map((s) => [
        s.scheduleId,
        {
          status: s.checkedInAt ? 'success' : 'idle',
          checkedInAt: s.checkedInAt,
          distanceM: s.distanceM,
          errorMsg: null,
        } satisfies RowState,
      ]),
    ),
  )
  // null saat render server supaya tidak hydration mismatch; diisi di client.
  const [now, setNow] = useState<number | null>(null)
  const [modalFor, setModalFor] = useState<string | null>(null)
  const [permission, setPermission] = useState<LocationPermission | null>(null)

  const patchRow = (scheduleId: string, patch: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [scheduleId]: { ...prev[scheduleId], ...patch } }))

  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    let ps: PermissionStatus | null = null
    getLocationPermission().then((p) => {
      if (!cancelled) setPermission(p)
    })
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((s) => {
        if (cancelled) return
        ps = s
        s.onchange = () => setPermission(s.state)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (ps) ps.onchange = null
    }
  }, [])

  const isOpen = (s: CheckInScheduleItem) => now !== null && now >= new Date(s.opensAt).getTime()

  // Jadwal pertama yang sudah bisa diabsen tapi belum diabsen → diingatkan lewat modal.
  const pendingId =
    schedules.find((s) => rows[s.scheduleId]?.status !== 'success' && isOpen(s))?.scheduleId ?? null

  const dismissedKey = (scheduleId: string) => `checkin-modal-dismissed-${todayDateKey}-${scheduleId}`

  useEffect(() => {
    if (pendingId && !sessionStorage.getItem(dismissedKey(pendingId))) setModalFor(pendingId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingId])

  const handleDismissModal = () => {
    if (modalFor) sessionStorage.setItem(dismissedKey(modalFor), '1')
    setModalFor(null)
  }

  const handleAbsen = (scheduleId: string) => {
    if (!navigator.geolocation) {
      patchRow(scheduleId, { status: 'error', errorMsg: 'Browser tidak mendukung GPS.' })
      return
    }
    patchRow(scheduleId, { status: 'locating', errorMsg: null })
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setPermission('granted')
        patchRow(scheduleId, { status: 'sending' })
        try {
          const res = await fetch('/api/tutor-checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scheduleId,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          })
          const data = await res.json()
          if (data.isWithinRadius) {
            patchRow(scheduleId, {
              status: 'success',
              checkedInAt: data.checkedInAt,
              distanceM: data.distanceM,
            })
          } else {
            patchRow(scheduleId, {
              status: data.isWithinRadius === false ? 'outside' : 'error',
              errorMsg: data.message ?? data.error ?? 'Gagal absen.',
            })
          }
        } catch {
          patchRow(scheduleId, { status: 'error', errorMsg: 'Gagal menghubungi server.' })
        }
      },
      (err) => {
        let errorMsg = 'Gagal mendapatkan lokasi GPS.'
        if (err.code === 1) {
          errorMsg = DENIED_MSG
          setPermission('denied')
          setModalFor(scheduleId)
        } else if (err.code === 2) {
          errorMsg = 'GPS tidak tersedia. Pastikan Location/GPS aktif di pengaturan perangkat Anda.'
        } else if (err.code === 3) {
          errorMsg = 'GPS timeout. Pindah ke area lebih terbuka atau periksa sinyal, lalu coba lagi.'
        }
        patchRow(scheduleId, { status: 'error', errorMsg })
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  }

  const handleAbsenFromModal = () => {
    const scheduleId = modalFor
    setModalFor(null)
    if (scheduleId) handleAbsen(scheduleId)
  }

  const modalSchedule = schedules.find((s) => s.scheduleId === modalFor)

  return (
    <>
      {modalSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-5 flex items-start gap-3">
              <CalendarCheck className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">Absen: {modalSchedule.className}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {todayLabel} • {modalSchedule.startTime}–{modalSchedule.endTime}
                </p>
              </div>
              <button
                onClick={handleDismissModal}
                className="ml-auto p-1 rounded-full hover:bg-amber-100 text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {permission === 'denied' ? (
              <div className="px-6 py-5 space-y-3">
                <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-100 p-3">
                  <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-700">
                    Izin lokasi untuk situs ini diblokir, jadi absensi tidak bisa dilakukan.
                  </p>
                </div>
                <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                  <p>
                    <span className="font-semibold">Android (Chrome):</span> ketuk ikon 🔒 / ⓘ di sebelah alamat
                    situs → <em>Izin</em> → <em>Lokasi</em> → <em>Izinkan</em>.
                  </p>
                  <p>
                    <span className="font-semibold">Aplikasi terpasang (PWA):</span> tahan ikon aplikasi →{' '}
                    <em>Info aplikasi</em> → <em>Izin</em> → <em>Lokasi</em> → <em>Izinkan</em>.
                  </p>
                  <p>
                    <span className="font-semibold">iPhone (Safari):</span> <em>Pengaturan</em> →{' '}
                    <em>Privasi &amp; Keamanan</em> → <em>Layanan Lokasi</em> (aktifkan) → <em>Situs Web Safari</em>{' '}
                    → <em>Saat Menggunakan App</em>. Lalu di Safari ketuk <em>aA</em> → <em>Pengaturan Situs Web</em>{' '}
                    → <em>Lokasi</em> → <em>Izinkan</em>.
                  </p>
                  <p>Pastikan juga GPS/Lokasi di perangkat menyala.</p>
                </div>
              </div>
            ) : (
              <div className="px-6 py-5">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Kamu belum absen untuk sesi ini. Absen wajib dilakukan agar kehadiranmu tercatat dan laporan
                  sesi ini bisa ditulis.
                </p>
                {permission === 'prompt' && (
                  <p className="text-sm text-slate-600 leading-relaxed mt-2">
                    Absensi memakai lokasi GPS. Setelah menekan tombol di bawah, browser akan meminta izin lokasi —
                    pilih <span className="font-semibold">Izinkan</span>.
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  📍 Absensi hanya berlaku dalam radius 500m dari lokasi bimbel.
                </p>
              </div>
            )}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={handleAbsenFromModal}
                className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <MapPin className="h-4 w-4" />
                {permission === 'denied' ? 'Coba Lagi' : permission === 'prompt' ? 'Izinkan & Absen' : 'Absen Sekarang'}
              </button>
              <button
                onClick={handleDismissModal}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Nanti
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
        <div className="flex items-center gap-2 mb-0.5">
          <MapPin className="h-4 w-4 shrink-0 text-teal-600" />
          <p className="font-bold text-slate-800 text-sm">Absensi per Jadwal</p>
        </div>
        <p className="text-xs text-slate-500">{todayLabel} • absen sekali untuk tiap sesi</p>

        {schedules.length === 0 ? (
          <p className="text-sm text-slate-400 mt-2">Tidak ada jadwal mengajar hari ini.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {schedules.map((s) => {
              const row = rows[s.scheduleId]
              const open = isOpen(s)
              const late =
                row.status === 'success' &&
                row.checkedInAt !== null &&
                new Date(row.checkedInAt).getTime() > new Date(s.startsAt).getTime()
              return (
                <div
                  key={s.scheduleId}
                  className={`rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                    row.status === 'success'
                      ? 'border-emerald-200'
                      : row.status === 'outside' || row.status === 'error'
                        ? 'border-rose-200'
                        : 'border-slate-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{s.className}</p>
                    <p className="text-xs text-slate-500">
                      {s.startTime}–{s.endTime}
                    </p>

                    {row.status === 'success' && row.checkedInAt && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <p className="text-sm font-semibold text-emerald-700">
                          Sudah absen pukul {formatTime(row.checkedInAt)}
                          {row.distanceM !== null && (
                            <span className="font-normal text-emerald-600"> ({row.distanceM}m dari lokasi)</span>
                          )}
                        </p>
                        {late && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            TERLAMBAT
                          </span>
                        )}
                      </div>
                    )}

                    {(row.status === 'outside' || row.status === 'error') && (
                      <div className="flex items-start gap-1.5 mt-1.5">
                        <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-rose-600">{row.errorMsg}</p>
                      </div>
                    )}

                    {(row.status === 'locating' || row.status === 'sending') && (
                      <p className="text-sm text-teal-600 mt-1 flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {row.status === 'locating' ? 'Mendeteksi lokasi GPS...' : 'Menyimpan absensi...'}
                      </p>
                    )}

                    {row.status === 'idle' && !open && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Absen dibuka pukul {formatTime(s.opensAt)}
                      </p>
                    )}
                  </div>

                  {open && (row.status === 'idle' || row.status === 'outside' || row.status === 'error') && (
                    <button
                      onClick={() => handleAbsen(s.scheduleId)}
                      className="shrink-0 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
                    >
                      <MapPin className="h-4 w-4" />
                      Absen Sekarang
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Ubah import di halaman tutor**

Di `app/(dashboard)/tutor/page.tsx`, ganti baris:

```tsx
import { getTodayWIB } from '@/lib/geolocation'
```

dengan:

```tsx
import { getTodayWIB } from '@/lib/geolocation'
import { checkInOpensAt, scheduleStartAt } from '@/lib/checkin-policy'
```

- [ ] **Step 3: Ubah query**

Ganti blok dari `const [schedules, todayCheckIn, hasScheduleToday] = await Promise.all([` sampai penutup `])` dengan:

```tsx
  const mine = {
    OR: [
      { class: { tutorId: userId } },
      { class: { additionalTutors: { some: { tutorId: userId } } } },
    ],
  }

  const [schedules, todaySchedules, todayCheckIns] = await Promise.all([
    prisma.schedule.findMany({
      where: {
        ...mine,
        date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      include: {
        class: { select: { name: true, _count: { select: { enrollments: true } } } },
        _count: { select: { reports: true, participants: true } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.schedule.findMany({
      where: {
        ...mine,
        date: { gte: todayStart, lte: todayEnd },
        status: { in: ['PUBLISHED', 'COMPLETED'] },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        class: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
    }),
    prisma.tutorCheckIn.findMany({
      where: { tutorId: userId, date: today, isWithinRadius: true, scheduleId: { not: null } },
      select: { scheduleId: true, checkedInAt: true, distanceM: true },
    }),
  ])

  const checkInItems = todaySchedules.map((s) => {
    const checkIn = todayCheckIns.find((c) => c.scheduleId === s.id)
    return {
      scheduleId: s.id,
      className: s.class.name,
      startTime: s.startTime,
      endTime: s.endTime,
      opensAt: checkInOpensAt(s.date, s.startTime).toISOString(),
      startsAt: scheduleStartAt(s.date, s.startTime).toISOString(),
      checkedInAt: checkIn?.checkedInAt.toISOString() ?? null,
      distanceM: checkIn ? Math.round(checkIn.distanceM) : null,
    }
  })
```

- [ ] **Step 4: Ubah pemakaian komponen**

Ganti blok:

```tsx
      {/* Absensi harian — satu kali per hari */}
      <TutorDailyCheckIn
        todayLabel={todayLabel}
        initialCheckedIn={todayCheckIn?.isWithinRadius ?? false}
        initialCheckedInAt={todayCheckIn?.checkedInAt.toISOString()}
        initialDistanceM={todayCheckIn ? Math.round(todayCheckIn.distanceM) : undefined}
        hasScheduleToday={!!hasScheduleToday}
        todayDateKey={today}
      />
```

dengan:

```tsx
      {/* Absensi — satu kali per jadwal hari ini */}
      <TutorDailyCheckIn todayLabel={todayLabel} todayDateKey={today} schedules={checkInItems} />
```

- [ ] **Step 5: Typecheck & lint**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "TutorDailyCheckIn|tutor/page|tutor-checkin|checkin-policy"`
Expected: tidak ada output.

Run: `npx eslint components/dashboard/TutorDailyCheckIn.tsx "app/(dashboard)/tutor/page.tsx"`
Expected: 0 error.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/TutorDailyCheckIn.tsx "app/(dashboard)/tutor/page.tsx"
git commit -m "feat(checkin): per-schedule check-in card on tutor dashboard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

### Task 6: Kunci jalur tulis laporan

**Files:**
- Modify: `app/api/reports/route.ts` (fungsi `POST`, setelah validasi zod)
- Modify: `app/api/schedules/[id]/reports/route.ts` (fungsi `POST`, setelah cek kepemilikan kelas)
- Test: `__tests__/api/reports-checkin-gate.test.ts`

Edit laporan lewat UI juga memakai `POST /api/reports` (upsert), jadi ikut terkunci secara konsisten: laporan untuk jadwal terkunci hanya bisa ada kalau aksesnya pernah terbuka, dan akses itu permanen. `PUT /api/reports/[id]` tidak diubah.

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/reports-checkin-gate.test.ts`:

```ts
import { POST } from '@/app/api/reports/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'
import { getTutorReportAccess } from '@/lib/report-access'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/report-notify', () => ({ notifyParentNewReport: jest.fn() }))
jest.mock('@/lib/report-access', () => ({ getTutorReportAccess: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    learningReport: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}))

const body = { studentId: 'st1', scheduleId: 's1', content: 'Bagus' }
const makeReq = () =>
  new NextRequest('http://localhost/api/reports', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

describe('POST /api/reports — check-in gate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // parentNotifiedAt terisi → jalur notifikasi WA tidak jalan di test
    ;(prisma.learningReport.findUnique as jest.Mock).mockResolvedValue({ id: 'r1', parentNotifiedAt: new Date() })
    ;(prisma.learningReport.upsert as jest.Mock).mockResolvedValue({ id: 'r1' })
  })

  it('blocks a tutor without report access', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 't1', role: 'TUTOR' } })
    ;(getTutorReportAccess as jest.Mock).mockResolvedValue({ allowed: false, reason: 'no-checkin' })
    const res = await POST(makeReq())
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('CHECKIN_REQUIRED')
    expect(prisma.learningReport.upsert).not.toHaveBeenCalled()
  })

  it('lets a tutor with report access save', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 't1', role: 'TUTOR' } })
    ;(getTutorReportAccess as jest.Mock).mockResolvedValue({ allowed: true, reason: 'checked-in' })
    const res = await POST(makeReq())
    expect(res.status).toBe(201)
    expect(getTutorReportAccess).toHaveBeenCalledWith('t1', 's1')
    expect(prisma.learningReport.upsert).toHaveBeenCalled()
  })

  it.each(['ADMIN', 'SUPER_ADMIN'])('does not gate %s', async (role) => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'a1', role } })
    const res = await POST(makeReq())
    expect(res.status).toBe(201)
    expect(getTutorReportAccess).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/reports-checkin-gate.test.ts`
Expected: FAIL — test "blocks a tutor without report access" mendapat 201, bukan 403.

- [ ] **Step 3: Kunci `POST /api/reports`**

Di `app/api/reports/route.ts`, tambah import:

```ts
import { getTutorReportAccess } from '@/lib/report-access'
```

Di fungsi `POST`, tepat setelah blok:

```ts
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
```

tambah:

```ts
  if (role === 'TUTOR') {
    const access = await getTutorReportAccess(userId, parsed.data.scheduleId)
    if (!access.allowed) {
      return NextResponse.json(
        {
          error: 'Laporan terkunci: absen dulu untuk jadwal ini, atau minta akses ke Super Admin.',
          code: 'CHECKIN_REQUIRED',
        },
        { status: 403 },
      )
    }
  }
```

- [ ] **Step 4: Kunci `POST /api/schedules/[id]/reports`**

Di `app/api/schedules/[id]/reports/route.ts`, tambah import:

```ts
import { getTutorReportAccess } from '@/lib/report-access'
```

Di fungsi `POST`, tepat setelah blok:

```ts
  if (role === 'TUTOR' && schedule.class.tutorId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
```

tambah:

```ts
  if (role === 'TUTOR') {
    const access = await getTutorReportAccess(userId, scheduleId)
    if (!access.allowed) {
      return NextResponse.json(
        {
          error: 'Laporan terkunci: absen dulu untuk jadwal ini, atau minta akses ke Super Admin.',
          code: 'CHECKIN_REQUIRED',
        },
        { status: 403 },
      )
    }
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/api/reports-checkin-gate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add app/api/reports/route.ts "app/api/schedules/[id]/reports/route.ts" __tests__/api/reports-checkin-gate.test.ts
git commit -m "feat(reports): require check-in or approved access for tutors to write reports

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

### Task 7: API permintaan akses laporan

**Files:**
- Create: `app/api/report-access/route.ts`
- Create: `app/api/admin/report-access/[id]/route.ts`
- Test: `__tests__/api/report-access.test.ts`

Skema alur:

```
Tutor belum absen ──► buka halaman laporan ──► panel "terkunci"
        │
        ├─ jendela absen masih buka ──► absen di dashboard ──► laporan terbuka
        │
        └─ tidak bisa absen ──► isi alasan ──► POST /api/report-access ──► PENDING
                                                         │
                         Super Admin (Monitoring Tutor) ─┤
                                                         ├─ PATCH APPROVED ──► laporan terbuka
                                                         └─ PATCH REJECTED (+catatan) ──► tutor boleh ajukan ulang
```

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/report-access.test.ts`:

```ts
import { GET, POST } from '@/app/api/report-access/route'
import { PATCH } from '@/app/api/admin/report-access/[id]/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'
import { getTutorReportAccess } from '@/lib/report-access'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/report-access', () => ({ getTutorReportAccess: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    reportAccessRequest: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  },
}))

const json = (url: string, method: string, body: object) =>
  new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

const asTutor = () =>
  (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 't1', role: 'TUTOR' } })
const asSuperAdmin = () =>
  (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'sa1', role: 'SUPER_ADMIN' } })

const blocked = (request: object | null = null) => ({
  allowed: false,
  reason: 'no-checkin',
  checkInWindow: 'closed',
  request,
})

beforeEach(() => jest.clearAllMocks())

describe('GET /api/report-access', () => {
  it('returns 400 without scheduleId', async () => {
    asTutor()
    expect((await GET(new NextRequest('http://localhost/api/report-access'))).status).toBe(400)
  })

  it('returns the tutor’s access for the schedule', async () => {
    asTutor()
    ;(getTutorReportAccess as jest.Mock).mockResolvedValue(blocked())
    const res = await GET(new NextRequest('http://localhost/api/report-access?scheduleId=s1'))
    expect(await res.json()).toMatchObject({ allowed: false, reason: 'no-checkin' })
    expect(getTutorReportAccess).toHaveBeenCalledWith('t1', 's1')
  })

  it('always allows admins without a lookup', async () => {
    asSuperAdmin()
    const res = await GET(new NextRequest('http://localhost/api/report-access?scheduleId=s1'))
    expect((await res.json()).allowed).toBe(true)
    expect(getTutorReportAccess).not.toHaveBeenCalled()
  })
})

describe('POST /api/report-access', () => {
  const post = (body: object) => POST(json('http://localhost/api/report-access', 'POST', body))

  it('returns 403 for non-tutor', async () => {
    asSuperAdmin()
    expect((await post({ scheduleId: 's1', reason: 'GPS rusak' })).status).toBe(403)
  })

  it('returns 400 when reason is too short', async () => {
    asTutor()
    expect((await post({ scheduleId: 's1', reason: 'ok' })).status).toBe(400)
  })

  it('returns 404 when schedule does not exist', async () => {
    asTutor()
    ;(getTutorReportAccess as jest.Mock).mockResolvedValue({ ...blocked(), reason: 'schedule-not-found' })
    expect((await post({ scheduleId: 's1', reason: 'GPS rusak' })).status).toBe(404)
  })

  it('returns 409 when access is already open', async () => {
    asTutor()
    ;(getTutorReportAccess as jest.Mock).mockResolvedValue({ ...blocked(), allowed: true, reason: 'checked-in' })
    expect((await post({ scheduleId: 's1', reason: 'GPS rusak' })).status).toBe(409)
  })

  it('returns 409 when a request is already pending', async () => {
    asTutor()
    ;(getTutorReportAccess as jest.Mock).mockResolvedValue(blocked({ id: 'r1', status: 'PENDING' }))
    expect((await post({ scheduleId: 's1', reason: 'GPS rusak' })).status).toBe(409)
    expect(prisma.reportAccessRequest.upsert).not.toHaveBeenCalled()
  })

  it('creates a pending request, and resets a rejected one', async () => {
    asTutor()
    ;(getTutorReportAccess as jest.Mock).mockResolvedValue(blocked({ id: 'r1', status: 'REJECTED' }))
    ;(prisma.reportAccessRequest.upsert as jest.Mock).mockResolvedValue({
      id: 'r1',
      status: 'PENDING',
      reason: 'GPS rusak',
      adminNote: null,
    })
    const res = await post({ scheduleId: 's1', reason: 'GPS rusak' })
    expect(res.status).toBe(201)
    expect(prisma.reportAccessRequest.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tutorId_scheduleId: { tutorId: 't1', scheduleId: 's1' } },
        create: { tutorId: 't1', scheduleId: 's1', reason: 'GPS rusak' },
        update: { reason: 'GPS rusak', status: 'PENDING', adminNote: null, decidedAt: null, decidedById: null },
      }),
    )
  })
})

describe('PATCH /api/admin/report-access/[id]', () => {
  const patch = (body: object) =>
    PATCH(json('http://localhost/api/admin/report-access/r1', 'PATCH', body), {
      params: Promise.resolve({ id: 'r1' }),
    })

  it('returns 403 for non-super-admin', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } })
    expect((await patch({ status: 'APPROVED' })).status).toBe(403)
  })

  it('returns 400 for an invalid status', async () => {
    asSuperAdmin()
    expect((await patch({ status: 'PENDING' })).status).toBe(400)
  })

  it('returns 404 when the request does not exist', async () => {
    asSuperAdmin()
    ;(prisma.reportAccessRequest.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await patch({ status: 'APPROVED' })).status).toBe(404)
  })

  it('records the decision and who made it', async () => {
    asSuperAdmin()
    ;(prisma.reportAccessRequest.findUnique as jest.Mock).mockResolvedValue({ id: 'r1' })
    ;(prisma.reportAccessRequest.update as jest.Mock).mockResolvedValue({ id: 'r1', status: 'REJECTED' })
    const res = await patch({ status: 'REJECTED', adminNote: 'Tidak hadir' })
    expect(res.status).toBe(200)
    expect(prisma.reportAccessRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({
          status: 'REJECTED',
          adminNote: 'Tidak hadir',
          decidedById: 'sa1',
          decidedAt: expect.any(Date),
        }),
      }),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api/report-access.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/report-access/route'`.

- [ ] **Step 3: Route tutor**

Create `app/api/report-access/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getTutorReportAccess, type TutorReportAccess } from '@/lib/report-access'

const requestSchema = z.object({
  scheduleId: z.string().min(1),
  reason: z.string().trim().min(5).max(500),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scheduleId = new URL(req.url).searchParams.get('scheduleId')
  if (!scheduleId) return NextResponse.json({ error: 'scheduleId wajib diisi' }, { status: 400 })

  // Hanya TUTOR yang dikunci; role lain selalu boleh.
  if ((session.user as any).role !== 'TUTOR') {
    const open: TutorReportAccess = { allowed: true, reason: 'exempt', checkInWindow: null, request: null }
    return NextResponse.json(open)
  }

  return NextResponse.json(await getTutorReportAccess((session.user as any).id, scheduleId))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = requestSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Alasan wajib diisi (5–500 karakter).' }, { status: 400 })
  }

  const tutorId = (session.user as any).id
  const { scheduleId, reason } = parsed.data

  const access = await getTutorReportAccess(tutorId, scheduleId)
  if (access.reason === 'schedule-not-found') {
    return NextResponse.json({ error: 'Jadwal tidak ditemukan.' }, { status: 404 })
  }
  if (access.allowed) {
    return NextResponse.json({ error: 'Akses laporan untuk jadwal ini sudah terbuka.' }, { status: 409 })
  }
  if (access.request?.status === 'PENDING') {
    return NextResponse.json({ error: 'Permintaan sedang menunggu persetujuan Super Admin.' }, { status: 409 })
  }

  const request = await prisma.reportAccessRequest.upsert({
    where: { tutorId_scheduleId: { tutorId, scheduleId } },
    create: { tutorId, scheduleId, reason },
    update: { reason, status: 'PENDING', adminNote: null, decidedAt: null, decidedById: null },
    select: { id: true, status: true, reason: true, adminNote: true },
  })

  return NextResponse.json(request, { status: 201 })
}
```

- [ ] **Step 4: Route Super Admin**

Create `app/api/admin/report-access/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const decisionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  adminNote: z.string().trim().max(500).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = decisionSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'status harus APPROVED atau REJECTED' }, { status: 400 })
  }

  const { id } = await params
  const existing = await prisma.reportAccessRequest.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Permintaan tidak ditemukan.' }, { status: 404 })

  const request = await prisma.reportAccessRequest.update({
    where: { id },
    data: {
      status: parsed.data.status,
      adminNote: parsed.data.adminNote || null,
      decidedAt: new Date(),
      decidedById: (session.user as any).id,
    },
    select: { id: true, status: true, adminNote: true },
  })

  return NextResponse.json(request)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/api/report-access.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 6: Commit**

```bash
git add app/api/report-access app/api/admin/report-access __tests__/api/report-access.test.ts
git commit -m "feat(reports): tutors request report access, super admin approves

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

### Task 8: UI laporan terkunci

**Files:**
- Create: `components/reports/ReportAccessLock.tsx`
- Modify: `components/reports/ReportInputClient.tsx` (import, state, `fetchData`, `handleSave`, render daftar siswa)

- [ ] **Step 1: Buat panel kunci**

Create `components/reports/ReportAccessLock.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lock, Send, Clock, XCircle, MapPin } from 'lucide-react'
import type { TutorReportAccess } from '@/lib/report-access'

interface Props {
  scheduleId: string
  access: TutorReportAccess
  onChange: (access: TutorReportAccess) => void
}

export function ReportAccessLock({ scheduleId, access, onChange }: Props) {
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = access.request
  const canStillCheckIn = access.checkInWindow === 'open' || access.checkInWindow === 'not-open'

  const submit = async () => {
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/report-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId, reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Gagal mengirim permintaan.')
      onChange({ ...access, request: data })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-amber-200 shadow-xs p-6 space-y-4">
      <div className="flex items-start gap-3">
        <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-bold text-slate-800">Laporan terkunci</h2>
          <p className="text-sm text-slate-600 mt-1">
            Kamu belum absen untuk jadwal ini. Laporan hanya bisa ditulis setelah absen di lokasi bimbel.
          </p>
        </div>
      </div>

      {canStillCheckIn && (
        <Link
          href="/tutor"
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
        >
          <MapPin className="h-4 w-4" />
          Absen di Dashboard
        </Link>
      )}

      <div className="border-t border-slate-100 pt-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Tidak bisa absen?</p>

        {request?.status === 'PENDING' ? (
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-200 p-3">
            <Clock className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-slate-700">Permintaan akses menunggu persetujuan Super Admin.</p>
              <p className="text-xs text-slate-500 mt-1">Alasan: {request.reason}</p>
              <p className="text-xs text-slate-400 mt-1">Muat ulang halaman ini setelah disetujui.</p>
            </div>
          </div>
        ) : (
          <>
            {request?.status === 'REJECTED' && (
              <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-100 p-3">
                <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-sm text-rose-700">
                  Permintaan sebelumnya ditolak{request.adminNote ? `: ${request.adminNote}` : '.'}
                </p>
              </div>
            )}
            <p className="text-xs text-slate-500">
              Jelaskan alasannya ke Super Admin (mis. GPS HP rusak, lupa absen). Jika disetujui, laporan jadwal
              ini akan terbuka.
            </p>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 resize-none"
              placeholder="Alasan tidak absen..."
            />
            {error && <p className="text-sm text-rose-600">⚠️ {error}</p>}
            <button
              onClick={submit}
              disabled={sending || reason.trim().length < 5}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Mengirim...' : 'Minta Akses ke Super Admin'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Import + state di `ReportInputClient`**

Di `components/reports/ReportInputClient.tsx`, setelah baris `import { StarRating } from '@/components/ui/star-rating'` tambah:

```tsx
import { ReportAccessLock } from '@/components/reports/ReportAccessLock'
import type { TutorReportAccess } from '@/lib/report-access'
```

Setelah baris `const [successIds, setSuccessIds] = useState<Set<string>>(new Set())` tambah:

```tsx
  const [access, setAccess] = useState<TutorReportAccess | null>(null)
```

- [ ] **Step 3: Muat status akses**

Di `fetchData`, ganti:

```tsx
        const [schedRes, reportsRes] = await Promise.all([
          fetch(`/api/schedules/${scheduleId}`),
          fetch(`/api/reports?scheduleId=${scheduleId}`),
        ])
        const schedData = await schedRes.json()
        const reportsData = await reportsRes.json()
        setSchedule(schedData)
```

dengan:

```tsx
        const [schedRes, reportsRes, accessRes] = await Promise.all([
          fetch(`/api/schedules/${scheduleId}`),
          fetch(`/api/reports?scheduleId=${scheduleId}`),
          fetch(`/api/report-access?scheduleId=${scheduleId}`),
        ])
        const schedData = await schedRes.json()
        const reportsData = await reportsRes.json()
        setSchedule(schedData)
        // Gagal memuat status akses → form tetap tampil; server tetap menolak simpan kalau terkunci.
        setAccess(accessRes.ok ? await accessRes.json() : null)
```

- [ ] **Step 4: Tampilkan pesan error dari server saat simpan**

Di `handleSave`, ganti:

```tsx
      if (!res.ok) throw new Error()
      const data = await res.json()
```

dengan:

```tsx
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(typeof body?.error === 'string' ? body.error : '')
      }
      const data = await res.json()
```

dan di `handleSave` yang sama ganti:

```tsx
    } catch {
      setError('Gagal menyimpan laporan untuk siswa ini.')
    } finally {
      setSaving(null)
    }
```

dengan:

```tsx
    } catch (e) {
      setError((e as Error).message || 'Gagal menyimpan laporan untuk siswa ini.')
    } finally {
      setSaving(null)
    }
```

- [ ] **Step 5: Render panel kunci**

Ganti baris:

```tsx
      {students.length === 0 ? (
```

dengan:

```tsx
      {access && !access.allowed ? (
        <ReportAccessLock scheduleId={scheduleId} access={access} onChange={setAccess} />
      ) : students.length === 0 ? (
```

- [ ] **Step 6: Typecheck & lint**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "ReportAccessLock|ReportInputClient"`
Expected: tidak ada output.

Run: `npx eslint components/reports/ReportAccessLock.tsx components/reports/ReportInputClient.tsx`
Expected: tidak ada error baru. `ReportInputClient.tsx` sudah punya peringatan lama (`any`, `<img>`); yang dicek hanya baris yang kamu ubah.

- [ ] **Step 7: Commit**

```bash
git add components/reports/ReportAccessLock.tsx components/reports/ReportInputClient.tsx
git commit -m "feat(reports): show locked state and access request form to tutors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

### Task 9: Monitoring per sesi + panel permintaan akses

**Files:**
- Create: `lib/tutor-monitoring.ts`
- Test: `__tests__/lib/tutor-monitoring.test.ts`
- Create: `app/(dashboard)/admin/tutor-monitoring/ReportAccessRequestsPanel.tsx`
- Modify: `app/(dashboard)/admin/tutor-monitoring/page.tsx` (ganti seluruh isi)
- Modify: `app/api/admin/tutor-monitoring/route.ts` (ganti seluruh isi)
- Modify: `app/(dashboard)/admin/tutor-monitoring/TutorMonitoringClient.tsx`

Halaman dan API route saat ini menyalin logika hitung yang sama → dipindah ke satu fungsi. Statistik berubah dari "hari hadir" ke "sesi hadir". Absen lama (tanpa `scheduleId`) tetap dihitung hadir untuk semua jadwal di tanggal yang sama. Sesi yang belum terjadi tidak ikut dihitung (sebelumnya jadwal sampai akhir bulan ikut jadi pembagi, sehingga rate terlihat lebih rendah dari kenyataan).

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/tutor-monitoring.test.ts`:

```ts
import { summarizeTutorAttendance } from '@/lib/tutor-monitoring'

const schedules = [
  { id: 's1', date: new Date('2026-10-20'), startTime: '15:00' },
  { id: 's2', date: new Date('2026-10-20'), startTime: '19:00' },
  { id: 's3', date: new Date('2026-10-05'), startTime: '15:00' },
]

const checkIn = (over: object) => ({
  id: 'c',
  scheduleId: null as string | null,
  date: '2026-10-20',
  checkedInAt: new Date('2026-10-20T07:50:00Z'),
  distanceM: 40,
  isWithinRadius: true,
  ...over,
})

describe('summarizeTutorAttendance', () => {
  it('returns null rate and zero counts with no schedules', () => {
    expect(summarizeTutorAttendance([], [])).toMatchObject({
      totalSessions: 0,
      validSessions: 0,
      lateSessions: 0,
      attendanceRate: null,
      avgDistanceM: null,
      lastCheckIn: null,
      recentCheckIns: [],
    })
  })

  it('counts one valid session per schedule check-in, not per day', () => {
    const s = summarizeTutorAttendance(schedules, [checkIn({ id: 'c1', scheduleId: 's1' })])
    expect(s.totalSessions).toBe(3)
    expect(s.validSessions).toBe(1)
    expect(s.attendanceRate).toBe(33)
  })

  it('ignores check-ins outside the radius', () => {
    const s = summarizeTutorAttendance(schedules, [checkIn({ scheduleId: 's1', isWithinRadius: false })])
    expect(s.validSessions).toBe(0)
  })

  it('counts a legacy per-day check-in for every schedule on that date', () => {
    const s = summarizeTutorAttendance(schedules, [checkIn({ scheduleId: null, date: '2026-10-20' })])
    expect(s.validSessions).toBe(2)
  })

  it('flags late check-ins made after the session start', () => {
    const s = summarizeTutorAttendance(schedules, [
      checkIn({ id: 'c1', scheduleId: 's1', checkedInAt: new Date('2026-10-20T08:05:00Z') }),
      checkIn({ id: 'c2', scheduleId: 's2', checkedInAt: new Date('2026-10-20T11:50:00Z') }),
    ])
    expect(s.lateSessions).toBe(1)
    expect(s.recentCheckIns.find((c) => c.id === 'c1')).toMatchObject({ late: true, startTime: '15:00' })
    expect(s.recentCheckIns.find((c) => c.id === 'c2')).toMatchObject({ late: false, startTime: '19:00' })
  })

  it('reports average distance and keeps at most 7 recent check-ins', () => {
    const many = Array.from({ length: 9 }, (_, i) => checkIn({ id: `c${i}`, distanceM: 10 + i }))
    const s = summarizeTutorAttendance(schedules, many)
    expect(s.recentCheckIns).toHaveLength(7)
    expect(s.avgDistanceM).toBe(14)
    expect(s.lastCheckIn).toBe('2026-10-20T07:50:00.000Z')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/tutor-monitoring.test.ts`
Expected: FAIL — `Cannot find module '@/lib/tutor-monitoring'`.

- [ ] **Step 3: Write implementation**

Create `lib/tutor-monitoring.ts`:

```ts
import { isLateCheckIn, scheduleDayWIB } from '@/lib/checkin-policy'

export type MonitoringSchedule = { id: string; date: Date; startTime: string }

export type MonitoringCheckIn = {
  id: string
  scheduleId: string | null
  date: string
  checkedInAt: Date
  distanceM: number
  isWithinRadius: boolean
}

export type CheckInRecord = {
  id: string
  date: string
  startTime: string | null
  checkedInAt: string
  distanceM: number
  isWithinRadius: boolean
  late: boolean
}

export type TutorAttendanceSummary = {
  totalSessions: number
  validSessions: number
  lateSessions: number
  attendanceRate: number | null
  avgDistanceM: number | null
  lastCheckIn: string | null
  recentCheckIns: CheckInRecord[]
}

// checkIns harus sudah diurutkan terbaru dulu (orderBy checkedInAt desc).
export function summarizeTutorAttendance(
  schedules: MonitoringSchedule[],
  checkIns: MonitoringCheckIn[],
): TutorAttendanceSummary {
  const byId = new Map(schedules.map((s) => [s.id, s]))
  const valid = checkIns.filter((c) => c.isWithinRadius)
  const validScheduleIds = new Set(valid.map((c) => c.scheduleId).filter(Boolean))
  // Absen lama (per hari, tanpa scheduleId) menutup semua jadwal di tanggal itu.
  const legacyDates = new Set(valid.filter((c) => c.scheduleId === null).map((c) => c.date))

  const isLate = (c: MonitoringCheckIn) => {
    const s = c.scheduleId ? byId.get(c.scheduleId) : undefined
    return !!s && isLateCheckIn(s.date, s.startTime, c.checkedInAt)
  }

  const validSessions = schedules.filter(
    (s) => validScheduleIds.has(s.id) || legacyDates.has(scheduleDayWIB(s.date)),
  ).length

  return {
    totalSessions: schedules.length,
    validSessions,
    lateSessions: valid.filter(isLate).length,
    attendanceRate: schedules.length > 0 ? Math.round((validSessions / schedules.length) * 100) : null,
    avgDistanceM:
      checkIns.length > 0
        ? Math.round(checkIns.reduce((sum, c) => sum + c.distanceM, 0) / checkIns.length)
        : null,
    lastCheckIn: checkIns[0]?.checkedInAt.toISOString() ?? null,
    recentCheckIns: checkIns.slice(0, 7).map((c) => ({
      id: c.id,
      date: c.date,
      startTime: (c.scheduleId && byId.get(c.scheduleId)?.startTime) || null,
      checkedInAt: c.checkedInAt.toISOString(),
      distanceM: Math.round(c.distanceM),
      isWithinRadius: c.isWithinRadius,
      late: isLate(c),
    })),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/tutor-monitoring.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Ganti API route**

Ganti seluruh isi `app/api/admin/tutor-monitoring/route.ts` dengan:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'
import { summarizeTutorAttendance } from '@/lib/tutor-monitoring'

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
          scheduleId: true,
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
            select: { id: true, date: true, startTime: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(
    tutors.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      suspended: t.suspended,
      ...summarizeTutorAttendance(
        t.tutorClasses.flatMap((c) => c.schedules),
        t.tutorCheckIns,
      ),
    })),
  )
}
```

- [ ] **Step 6: Ganti halaman**

Ganti seluruh isi `app/(dashboard)/admin/tutor-monitoring/page.tsx` dengan:

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Role } from '@prisma/client'
import { summarizeTutorAttendance } from '@/lib/tutor-monitoring'
import TutorMonitoringClient from './TutorMonitoringClient'

export default async function TutorMonitoringPage() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/admin')

  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)

  const [tutors, accessRequests] = await Promise.all([
    prisma.user.findMany({
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
            scheduleId: true,
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
                // lte now: sesi yang belum terjadi tidak ikut jadi pembagi rate
                date: { gte: from, lte: now },
                status: { in: ['PUBLISHED', 'COMPLETED'] },
              },
              select: { id: true, date: true, startTime: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.reportAccessRequest.findMany({
      // enum diurutkan sesuai deklarasi: PENDING dulu
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        status: true,
        reason: true,
        adminNote: true,
        createdAt: true,
        tutor: { select: { name: true } },
        schedule: {
          select: { date: true, startTime: true, endTime: true, class: { select: { name: true } } },
        },
      },
    }),
  ])

  const initialData = tutors.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    suspended: t.suspended,
    ...summarizeTutorAttendance(
      t.tutorClasses.flatMap((c) => c.schedules),
      t.tutorCheckIns,
    ),
  }))

  const requests = accessRequests.map((r) => ({
    id: r.id,
    status: r.status,
    reason: r.reason,
    adminNote: r.adminNote,
    createdAt: r.createdAt.toISOString(),
    tutorName: r.tutor.name ?? '—',
    className: r.schedule.class.name,
    scheduleDate: r.schedule.date.toISOString(),
    startTime: r.schedule.startTime,
    endTime: r.schedule.endTime,
  }))

  return <TutorMonitoringClient initialData={initialData} requests={requests} />
}
```

- [ ] **Step 7: Buat panel permintaan**

Create `app/(dashboard)/admin/tutor-monitoring/ReportAccessRequestsPanel.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { KeyRound, Check, X } from 'lucide-react'

export type AccessRequestRow = {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reason: string
  adminNote: string | null
  createdAt: string
  tutorName: string
  className: string
  scheduleDate: string
  startTime: string
  endTime: string
}

const statusStyle = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-600',
}

const statusLabel = { PENDING: 'MENUNGGU', APPROVED: 'DISETUJUI', REJECTED: 'DITOLAK' }

export function ReportAccessRequestsPanel({ initialRequests }: { initialRequests: AccessRequestRow[] }) {
  const [requests, setRequests] = useState(initialRequests)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length

  const decide = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/report-access/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNote: notes[id] ?? '' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Gagal menyimpan keputusan.')
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: data.status, adminNote: data.adminNote } : r)),
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
      <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-100">
        <KeyRound className="h-5 w-5 text-indigo-600" />
        <div>
          <p className="font-bold text-slate-800">Permintaan Akses Laporan</p>
          <p className="text-xs text-slate-500">
            Tutor yang tidak absen dan meminta dibukakan akses menulis laporan.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
            {pendingCount} menunggu
          </span>
        )}
      </div>

      {error && <p className="px-6 py-3 text-sm text-rose-600">⚠️ {error}</p>}

      {requests.length === 0 ? (
        <p className="px-6 py-6 text-center text-sm text-slate-400">Belum ada permintaan.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {requests.map((r) => (
            <div key={r.id} className="px-6 py-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">
                    {r.tutorName} <span className="font-normal text-slate-500">• {r.className}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(r.scheduleDate).toLocaleDateString('id-ID', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    • {r.startTime}–{r.endTime}
                  </p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyle[r.status]}`}>
                  {statusLabel[r.status]}
                </span>
              </div>

              <p className="text-sm text-slate-600">Alasan: {r.reason}</p>
              {r.status !== 'PENDING' && r.adminNote && (
                <p className="text-xs text-slate-500">Catatan admin: {r.adminNote}</p>
              )}

              {r.status === 'PENDING' && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    maxLength={500}
                    placeholder="Catatan (opsional)"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => decide(r.id, 'APPROVED')}
                    disabled={busyId === r.id}
                    className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Setujui
                  </button>
                  <button
                    onClick={() => decide(r.id, 'REJECTED')}
                    disabled={busyId === r.id}
                    className="flex items-center justify-center gap-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Tolak
                  </button>
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

- [ ] **Step 8: Ubah tipe & props `TutorMonitoringClient`**

Di `app/(dashboard)/admin/tutor-monitoring/TutorMonitoringClient.tsx`, ganti blok dari `type CheckInRecord = {` sampai penutup `interface Props { ... }`:

```tsx
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
```

dengan:

```tsx
type TutorRow = TutorAttendanceSummary & {
  id: string
  name: string
  email: string
  suspended: boolean
}

interface Props {
  initialData: TutorRow[]
  requests: AccessRequestRow[]
}
```

dan tambah import di bawah import `lucide-react`:

```tsx
import type { TutorAttendanceSummary } from '@/lib/tutor-monitoring'
import { ReportAccessRequestsPanel, type AccessRequestRow } from './ReportAccessRequestsPanel'
```

Ganti `export default function TutorMonitoringClient({ initialData }: Props) {` dengan:

```tsx
export default function TutorMonitoringClient({ initialData, requests }: Props) {
```

- [ ] **Step 9: Ubah statistik & teks ke "sesi"**

Lakukan penggantian berikut di file yang sama:

a) Ganti:
```tsx
  const totalCheckInDays = data.reduce((s, t) => s + t.totalValidDays, 0)
```
dengan:
```tsx
  const totalValidSessions = data.reduce((s, t) => s + t.validSessions, 0)
```

b) Ganti:
```tsx
          Rekap absensi harian tutor bulan ini — satu absensi per hari per tutor.
          Radius wajib: 500m dari titik pusat bimbel.
```
dengan:
```tsx
          Rekap absensi tutor bulan ini — satu absensi per jadwal mengajar.
          Radius wajib: 500m dari titik pusat bimbel.
```

c) Ganti:
```tsx
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
```
dengan:
```tsx
          { label: 'Sesi Hadir (Bulan Ini)', value: totalValidSessions, sub: 'total absen valid' },
          {
            label: 'Rata-rata Kehadiran',
            value: avgRate !== null ? `${avgRate}%` : '—',
            sub: 'dari sesi yang sudah berjalan',
          },
          {
            label: 'Tutor Belum Absen',
            value: data.filter((t) => t.validSessions === 0).length,
            sub: 'bulan ini',
          },
```

d) Tepat setelah penutup `</div>` dari grid kartu statistik (blok `<div className="grid gap-4 grid-cols-2 sm:grid-cols-4">`), tambah:
```tsx
      <ReportAccessRequestsPanel initialRequests={requests} />
```

e) Ganti:
```tsx
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
```
dengan:
```tsx
                    <div className="hidden sm:flex flex-col items-end gap-0.5">
                      <p className="text-xs text-slate-400">Sesi Hadir</p>
                      <p className="text-sm font-bold text-slate-700">
                        {tutor.validSessions}/{tutor.totalSessions}
                      </p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-0.5">
                      <p className="text-xs text-slate-400">Terlambat</p>
                      <p className="text-sm font-bold text-slate-700">{tutor.lateSessions}</p>
                    </div>
```

f) Ganti:
```tsx
                              <div>
                                <p className="text-sm font-semibold text-slate-700">{dateLabel}</p>
                                <p className="text-xs text-slate-400">Absen pukul {timeLabel}</p>
                              </div>
```
dengan:
```tsx
                              <div>
                                <p className="text-sm font-semibold text-slate-700">
                                  {dateLabel}
                                  {ci.startTime && (
                                    <span className="font-normal text-slate-500"> • sesi {ci.startTime}</span>
                                  )}
                                </p>
                                <p className="text-xs text-slate-400">
                                  Absen pukul {timeLabel}
                                  {ci.late && <span className="ml-2 font-bold text-amber-600">TERLAMBAT</span>}
                                </p>
                              </div>
```

g) Ganti:
```tsx
            Koordinat: -7.041736, 113.558258 • Radius: 500 meter • 1 absensi per hari per tutor
```
dengan:
```tsx
            Koordinat: -7.041736, 113.558258 • Radius: 500 meter • 1 absensi per jadwal • dibuka 30 menit sebelum sesi
```

- [ ] **Step 10: Typecheck, lint, suite penuh**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "tutor-monitoring|ReportAccessRequestsPanel|report-access|checkin"`
Expected: tidak ada output.

Run: `npx eslint "app/(dashboard)/admin/tutor-monitoring" lib/tutor-monitoring.ts app/api/admin/tutor-monitoring/route.ts`
Expected: 0 error.

Run: `npx jest --testPathIgnorePatterns ".claude/worktrees"`
Expected: semua suite PASS.

- [ ] **Step 11: Commit**

```bash
git add lib/tutor-monitoring.ts __tests__/lib/tutor-monitoring.test.ts "app/(dashboard)/admin/tutor-monitoring" app/api/admin/tutor-monitoring/route.ts
git commit -m "feat(monitoring): per-session tutor attendance and report access requests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 12: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

### Task 10: Verifikasi manual + rilis

**Files:** `lib/checkin-policy.ts` (hanya konstanta `REPORT_GATE_FROM`, saat rilis).

Siapkan data lokal: satu tutor dengan 2 jadwal `PUBLISHED` hari ini (mis. satu mulai ≤ 30 menit lagi, satu beberapa jam lagi), masing-masing punya peserta. Untuk lolos radius di laptop: Chrome DevTools → ⋮ → More tools → Sensors → Location → Custom `-7.041736, 113.558258`.

- [ ] **Step 1: Absen per jadwal**

`npm run dev`, login tutor, buka `/tutor`.
Expected: kartu "Absensi per Jadwal" berisi 2 baris. Jadwal yang jendelanya sudah buka punya tombol "Absen Sekarang" dan modal pengingat muncul; jadwal satunya menampilkan "Absen dibuka pukul HH:MM" tanpa tombol.

- [ ] **Step 2: Absen jadwal pertama**

Klik "Absen Sekarang" → Allow.
Expected: baris pertama "Sudah absen pukul …"; baris kedua tetap belum absen. Reload → status bertahan.

- [ ] **Step 3: Terlambat & luar radius**

Untuk jadwal yang sudah lewat jam mulainya: absen → badge "TERLAMBAT". Ubah lokasi Sensors ke `-7.035736, 113.558258` (±667 m) lalu absen jadwal lain → pesan "Anda berada …m dari lokasi bimbel", tombol tetap ada.

- [ ] **Step 4: Laporan terkunci**

Buka `/tutor/reports/<scheduleId>` untuk jadwal yang BELUM diabsen.
Expected: panel "Laporan terkunci" (bukan form siswa), tombol "Absen di Dashboard", form alasan. Untuk jadwal yang sudah diabsen: form laporan tampil normal dan bisa disimpan.

- [ ] **Step 5: Kunci di server**

Dengan session tutor di DevTools Console:

```js
fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ studentId: '<id peserta>', scheduleId: '<jadwal belum diabsen>', content: 'tes' }) })
  .then(r => r.json().then(b => console.log(r.status, b)))
```

Expected: `403 { error: 'Laporan terkunci…', code: 'CHECKIN_REQUIRED' }`.

- [ ] **Step 6: Alur buka akses**

Tutor: isi alasan → "Minta Akses ke Super Admin" → status "menunggu persetujuan".
Super Admin: buka `/admin/tutor-monitoring` → panel "Permintaan Akses Laporan" menampilkan badge "1 menunggu" → klik **Tolak** dengan catatan.
Tutor: reload halaman laporan → "Permintaan sebelumnya ditolak: <catatan>" + form ajukan ulang → ajukan lagi.
Super Admin: reload → **Setujui**.
Tutor: reload → form laporan terbuka, simpan berhasil.
Expected di monitoring: sesi itu TIDAK bertambah di "Sesi Hadir" (akses ≠ hadir).

- [ ] **Step 7: Jadwal lama & admin**

Buka laporan jadwal bertanggal sebelum `REPORT_GATE_FROM` sebagai tutor → form tampil normal (bebas kunci). Login ADMIN → `/admin/reports/<scheduleId>` jadwal mana pun → form tampil, simpan berhasil.

- [ ] **Step 8: Set tanggal mulai kunci & rilis**

Ubah `REPORT_GATE_FROM` di `lib/checkin-policy.ts` ke tanggal deploy production (format `YYYY-MM-DD`). Jalankan `npx jest __tests__/lib/checkin-policy.test.ts __tests__/lib/report-access.test.ts` → PASS (test memakai konstanta, bukan tanggal tetap).

```bash
git add lib/checkin-policy.ts
git commit -m "chore(checkin): set report gate start date

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Deploy di luar jam mengajar: migrasi jalan otomatis (`prisma migrate deploy` di `docker-compose.prod.yml`). Absen per hari yang sudah dibuat di hari deploy tidak berlaku untuk jadwal hari itu — tutor perlu absen ulang per jadwal.

- [ ] **Step 9: Report ke user**

Lapor: hasil tiap skenario (lulus/gagal + teks error bila gagal), dan nilai akhir `REPORT_GATE_FROM`.

---

## Di luar scope (sengaja)

- **Notifikasi WhatsApp ke Super Admin saat ada permintaan baru** — tutor "lapor" lewat form; Super Admin melihat badge di Monitoring Tutor. Tambah (`lib/waha.ts` sudah ada) kalau permintaan sering telat direspons.
- **Badge jumlah permintaan di sidebar** — tambah bersamaan dengan notifikasi di atas.
- **Tutor tambahan di statistik monitoring** — statistik tetap hanya menghitung kelas tempat tutor jadi tutor utama (perilaku lama). Absen dan kunci laporan sudah berlaku untuk tutor tambahan.
- **Sesi di luar lokasi bimbel** — semua sesi di bimbel; kalau nanti ada privat di rumah siswa, perlu titik lokasi per jadwal.
- **Satu tap untuk sesi berurutan** — sengaja tetap satu absen per jadwal sesuai aturan.
- **Celah lama:** `POST /api/reports` tidak mengecek tutor itu pengajar kelasnya. Sekarang tertutup secara efektif untuk jadwal ≥ `REPORT_GATE_FROM` (absen hanya bisa untuk jadwal sendiri; selain itu harus disetujui Super Admin). Untuk jadwal lama celahnya masih ada.
