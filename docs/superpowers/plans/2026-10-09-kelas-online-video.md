# Kelas Online (Video Meeting In-App) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mellyna bisa menjalankan kelas online (video call seperti Zoom) langsung di dalam aplikasi, dengan durasi sesi yang diatur SUPER_ADMIN (30 / 40 / 60 menit atau angka bebas) dan **ditegakkan di server** — peserta otomatis dikeluarkan saat waktu habis.

**Architecture:** `Schedule` dapat flag `isOnline` + `durationMinutes`. Video pakai provider managed **Daily (Prebuilt, di-embed lewat `@daily-co/daily-js`)** — tidak ada media server di VPS. Room Daily dibuat lazy saat orang pertama join, bersifat `private`, dengan `nbf`/`exp` + `eject_at_room_exp` dari jadwal; token per-user dibuat server (tutor/admin = owner) dengan `exp` + `eject_at_token_exp`. Durasi default disimpan di `SystemSetting` (`ONLINE_CLASS_DURATION_MIN`) yang hanya bisa diubah SUPER_ADMIN.

**Tech Stack:** Next.js 15 App Router, next-auth v4 (JWT), Prisma 6 + PostgreSQL, zod, Daily REST API + `@daily-co/daily-js`, Jest (`next/jest`, testEnvironment node).

---

## Bagian A — Riset & Analisis

### A1. Apa yang sebenarnya dibutuhkan

| Kebutuhan | Kenapa penting |
|---|---|
| Video + audio + share screen, tutor 1 : siswa banyak | Inti "seperti Zoom" |
| Join **di dalam aplikasi Mellyna** (PWA, HP) tanpa install app lain / tanpa akun pihak ketiga | Wali murid anak kecil — tiap langkah tambahan = siswa telat/gagal masuk |
| Hanya tutor kelas + siswa terdaftar di jadwal yang bisa masuk | Keamanan anak; link bocor tidak boleh bisa dipakai orang luar |
| **Durasi diatur SUPER_ADMIN** (30/40/menit bebas) dan **dipaksa berakhir** | Permintaan utama; harus di server, bukan cuma timer di layar |
| Biaya rendah & tidak membebani VPS Sumopod | VPS sekarang sudah jalan app + Postgres + MinIO + n8n + WhatDesks |

### A2. Opsi yang dibandingkan

| Opsi | Join in-app | Durasi dipaksa server | Biaya (lihat catatan sumber) | Kerja dev | Catatan |
|---|---|---|---|---|---|
| **0. Tempel link Meet/Zoom di kolom "Lokasi"** | ❌ keluar app | ❌ | Rp0 (Meet gratis), Zoom Basic gratis | **0 — sudah bisa hari ini** | Tanpa kontrol siapa masuk, tanpa durasi dari superadmin. Cocok untuk uji pasar 1–2 minggu. |
| **1. Zoom (Meeting SDK / API)** | Sebagian (SDK web) | ❌ hanya host akhiri manual; Basic otomatis putus 40 menit (bukan pilihan kita) | Pro ±US$15/host/bulan; Meeting SDK butuh lisensi meeting per host | Tinggi | Batas 40 menit Zoom gratis kebetulan sama dengan "40 menit", tapi tidak bisa diatur jadi 30/60. |
| **2. Google Meet API** | ❌ link keluar app | ❌ | Butuh Google Workspace; Meet gratis dibatasi 60 menit untuk 3+ orang | Sedang | Tidak ada embed resmi. |
| **3. Jitsi self-host di VPS** | ✅ iframe | ❌ tidak native (butuh modul Prosody custom) | Software gratis, **bandwidth & CPU VPS** | Tinggi + ops | Butuh UDP 10000, TURN, monitoring. Beban server tumbuh linear per kelas. |
| **4. LiveKit Cloud** | ✅ (UI dibangun sendiri pakai `@livekit/components-react`) | ⚠️ Tidak ditemukan batas durasi room native di dokumen quota; harus scheduler yang hapus room tepat waktu | Build gratis 5.000 participant-min/bulan, **lewat kuota = request gagal** (bukan ditagih); Ship ±US$50/bln 150.000 menit | Sedang-tinggi | Termurah di volume besar. |
| **5. Daily (Prebuilt embed)** ⭐ | ✅ iframe siap pakai (grid, chat, share screen, prejoin cek kamera) | ✅ **native**: room `exp` + `eject_at_room_exp`, token `exp` + `eject_at_token_exp` | Gratis 10.000 participant-min/bulan, lalu ±US$0,004/participant-min | **Rendah** | Satu SDK, enforcement durasi tanpa cron. |

### A3. Rekomendasi

**Pakai Daily Prebuilt sekarang, desain dibuat bisa ganti ke LiveKit nanti.**

Alasan:
1. **Enforcement durasi native** — permintaan utama ("superadmin set 30/40 menit") jadi properti room/token, bukan cron yang bisa telat/mati. Room di-set `exp = jam selesai` + `eject_at_room_exp: true` → semua peserta dikeluarkan otomatis tepat waktu, meskipun browser tutor tertutup.
2. **Kode paling sedikit** — UI video (grid, mute, share screen, chat, cek kamera sebelum masuk) sudah jadi. Kita hanya bikin 2 file integrasi (`lib/daily.ts`, `OnlineRoomClient.tsx`) + 1 endpoint join.
3. **VPS tidak tersentuh** — media lewat SFU Daily, bukan Sumopod.
4. **Keamanan anak** — room `private`; tanpa token dari server Mellyna tidak bisa masuk. Token terikat `room_name` (dokumen Daily memperingatkan token tanpa `room_name` bisa masuk ke room mana pun — kita selalu isi).
5. **Exit cost terbatas** — semua kode spesifik Daily ada di `lib/daily.ts` + `OnlineRoomClient.tsx`. Pindah ke LiveKit = ganti dua file itu + tambah scheduler penutup room.

Kapan pindah ke LiveKit: kalau tagihan Daily rutin > ±US$50/bulan (lihat A4 — sekitar >110 sesi/bulan dengan asumsi 5 peserta × 40 menit). Pada titik itu LiveKit Ship lebih murah, sepadan dengan kerja tambahan bikin UI sendiri.

### A4. Estimasi biaya (Daily)

Asumsi (ubah sesuai data riil): 1 sesi = 1 tutor + 4 siswa = **5 peserta × 40 menit = 200 participant-minute**. Kurs asumsi **Rp16.000/US$**.

| Sesi online / bulan | Participant-min | Berbayar (lewat 10.000 gratis) | Biaya/bulan |
|---|---|---|---|
| 50 | 10.000 | 0 | **Rp0** |
| 100 | 20.000 | 10.000 × $0,004 = $40 | ±Rp640rb |
| 200 | 40.000 | 30.000 × $0,004 = $120 | ±Rp1,9jt (pertimbangkan LiveKit) |

Per sesi setelah kuota gratis: 200 × $0,004 = **$0,80 ≈ Rp12.800/sesi**, atau ±Rp3.200 per siswa per sesi — jauh di bawah harga SPP per sesi.

Rekaman (cloud recording) **tidak** diaktifkan: biaya tambahan per menit + data video anak di bawah umur (UU PDP — perlu persetujuan wali). Masuk fase 2 kalau memang dibutuhkan.

### A5. Status bukti (mana yang sudah dicek, mana yang belum)

- **Diverifikasi dari dokumen resmi Daily (2026-10-09):** room `exp` ("participants are not able to connect to the room after that time"), `nbf`, `eject_at_room_exp` (peserta di dalam dikeluarkan saat room expire), `privacy` default `public` (kita set `private`); token `room_name`, `exp`, `eject_at_token_exp`, `eject_after_elapsed`; token dikirim lewat `join({ url, token })`, bukan query string.
- **Diverifikasi dari dokumen resmi LiveKit:** Build 5.000 participant-min, lewat kuota request gagal; tidak ada batas durasi room di halaman quota.
- **Dari sumber pihak ketiga (cek ulang di daily.co/pricing sebelum komit budget):** 10.000 menit gratis & $0,004/menit. Satu sumber menyebut Daily pindah ke "custom pricing" Maret 2026 — **ini yang paling mungkin membalik rekomendasi**; kalau harga resmi jauh berbeda, pilih LiveKit.
- **Ingatan, belum dicek:** Zoom Pro ±$15/host, Meet gratis 60 menit, kurs Rp16.000, properti room `enable_prejoin_ui`. Konsumsi data siswa di HP belum diukur — ukur saat uji coba (Task 10).

### A6. Risiko & mitigasi

| Risiko | Dampak | Mitigasi di plan ini |
|---|---|---|
| `Permissions-Policy: camera=(), microphone=()` di `next.config.ts` **memblok kamera/mic untuk iframe apa pun** | Video tidak jalan sama sekali, error tidak jelas | Task 7 buka izin hanya untuk origin Daily |
| Zona waktu: `Schedule.date` ada yang tersimpan UTC-midnight (form admin `new Date('YYYY-MM-DD')`) dan ada pola `T00:00:00+07:00` (WIB) | Room kebuka/tertutup 7 jam meleset — **gagal diam-diam** | `scheduleWindow()` geser +7 jam dulu sebelum ambil tanggal; dites untuk kedua bentuk (Task 2) |
| Jadwal digeser setelah room dibuat | Room lama punya `exp` lama | Nama room memuat epoch mulai & selesai → jadwal berubah = room baru otomatis |
| ADMIN mengubah durasi lewat edit jadwal | Melanggar "durasi diatur superadmin" | Server menghitung ulang `endTime` dari `durationMinutes`; override durasi hanya diterima dari SUPER_ADMIN (Task 5) |
| Internet siswa lemah | Putus-putus | Daily adaptif (simulcast); tombol join bisa dipakai ulang selama jendela waktu masih buka |
| Harga Daily berubah | Biaya naik | Kode Daily terisolasi 2 file; LiveKit sebagai jalur keluar |

### A7. Di luar scope (fase 2, tambah kalau ada permintaan nyata)

- Absensi otomatis dari webhook `participant.joined` Daily.
- Link kelas online di pesan WA broadcast jadwal.
- Rekaman kelas ke MinIO.
- Jadwal online dari cron `timetable-generate` (cron sekarang tetap membuat jadwal offline; jadwal online dibuat manual di menu Jadwal, sudah mendukung berulang mingguan).
- Jadwal online yang melewati tengah malam (ditolak dengan pesan jelas).

---

## Bagian B — Skema

### B1. Database (Prisma)

```prisma
model Schedule {
  // ...field existing...
  isOnline        Boolean @default(false)
  durationMinutes Int?    // snapshot durasi saat dibuat; null untuk jadwal offline
}
```

Tidak ada tabel baru. Tidak simpan `roomName`/`roomUrl` — nama room diturunkan deterministik: `mly-<scheduleId>-<startEpochSec>-<endEpochSec>`.

`SystemSetting` (tabel key-value existing):

| key | value | default | siapa ubah |
|---|---|---|---|
| `ONLINE_CLASS_DURATION_MIN` | bilangan bulat 10–180 (string) | `"40"` | SUPER_ADMIN (route settings sudah SUPER_ADMIN-only) |

### B2. Aturan durasi

1. Buat jadwal online → `durationMinutes` = override dari body **hanya jika actor SUPER_ADMIN**, kalau tidak = nilai `ONLINE_CLASS_DURATION_MIN` (fallback 40 jika setting kosong/rusak).
2. `endTime` jadwal online **selalu dihitung server**: `startTime + durationMinutes`. Input `endTime` dari client diabaikan.
3. Edit jadwal online (PUT) → `endTime` dihitung ulang dari `startTime` baru × `durationMinutes` (SUPER_ADMIN boleh kirim `durationMinutes` baru).
4. Ubah setting global **tidak** mengubah jadwal yang sudah dibuat (snapshot) — sama seperti harga di invoice.

### B3. Alur join

```
Tutor/Wali klik "🎥 Masuk Kelas Online"
   │
   ▼
/kelas-online/[scheduleId]  (OnlineRoomClient)
   │ POST /api/schedules/[id]/online
   ▼
Server:
  1. session? → 401
  2. schedule ada & isOnline? → 404
  3. status PUBLISHED/COMPLETED? → 409
  4. Otorisasi:
       SUPER_ADMIN/ADMIN → owner, nama "<nama> (Admin)"
       TUTOR → harus tutor utama / tambahan kelas → owner
       PARENT → harus punya anak di participants jadwal → nama "Andi & Budi"
       lainnya → 403
  5. Jendela waktu (WIB): sekarang < mulai−10 mnt → 409 "belum dibuka"
                          sekarang ≥ selesai     → 410 "sudah berakhir"
  6. ensureRoom(name, nbf=mulai−10mnt, exp=selesai)   ── Daily REST
  7. createMeetingToken(room, userName, isOwner, exp=selesai)
  8. → { url, token, endsAt }
   │
   ▼
Client: DailyIframe.createFrame() → join({ url, token }) + hitung mundur
   │
   ▼
Waktu habis → Daily mengeluarkan semua peserta (eject_at_room_exp / eject_at_token_exp)
            → event 'left-meeting' → router.back()
```

Penegakan berlapis: (a) API menolak di luar jendela; (b) room `nbf`/`exp`; (c) token `exp` + eject. Timer di layar hanya informasi.

---

## Bagian C — File Structure

- Modify: `prisma/schema.prisma` — `Schedule.isOnline`, `Schedule.durationMinutes`.
- Create: `prisma/migrations/<timestamp>_schedule_online/migration.sql` — dibuat oleh `prisma migrate dev`.
- Create: `lib/online-class.ts` — konstanta + fungsi murni durasi & jendela waktu WIB.
- Create: `lib/daily.ts` — `ensureRoom()`, `createMeetingToken()` (Daily REST).
- Modify: `app/api/admin/settings/route.ts` — default + validasi `ONLINE_CLASS_DURATION_MIN`.
- Modify: `app/(dashboard)/admin/settings/page.tsx`, `SettingsClient.tsx` — kartu "Durasi Kelas Online".
- Modify: `app/api/schedules/route.ts` — POST terima `isOnline`, `durationMinutes`; hitung `endTime`.
- Modify: `app/api/schedules/[id]/route.ts` — PUT hitung ulang `endTime` untuk jadwal online.
- Create: `app/api/schedules/[id]/online/route.ts` — POST join (otorisasi + jendela + token).
- Modify: `next.config.ts` — Permissions-Policy & CSP untuk origin Daily.
- Create: `app/(dashboard)/kelas-online/[id]/page.tsx`, `OnlineRoomClient.tsx` — halaman video.
- Create: `components/dashboard/JoinOnlineButton.tsx` — tombol masuk.
- Modify: `app/(dashboard)/tutor/page.tsx`, `components/dashboard/ParentScheduleList.tsx`, `app/(dashboard)/admin/schedules/page.tsx`, `SchedulesClient.tsx` — tombol/form online.
- Modify: `.env.example` — `DAILY_API_KEY`.
- Tests: `__tests__/lib/online-class.test.ts`, `__tests__/lib/daily.test.ts`, `__tests__/api/admin-settings-online-duration.test.ts`, `__tests__/api/schedules-online-create.test.ts`, `__tests__/api/schedules-online-join.test.ts`.

---

### Task 0: Siapkan akun Daily (manual, non-kode)

- [ ] **Step 1:** Daftar di https://dashboard.daily.co, catat **subdomain** (mis. `mellyna` → `https://mellyna.daily.co`) dan buat **API key** (Developers → API keys).
- [ ] **Step 2:** Cek halaman https://www.daily.co/pricing — pastikan kuota gratis & tarif per menit masih sesuai A4. Jika berbeda jauh, **berhenti dan laporkan ke user** sebelum lanjut (rekomendasi bisa berubah ke LiveKit).
- [ ] **Step 3:** Tambah ke `.env.local` (dev) dan `.env` server produksi:

```
DAILY_API_KEY=<api key dari dashboard>
```

- [ ] **Step 4:** Tambah baris yang sama (tanpa nilai) ke `.env.example`:

```
# Daily (kelas online) — https://dashboard.daily.co
DAILY_API_KEY=
```

- [ ] **Step 5: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 6: Commit**

```bash
rtk git add .env.example
rtk git commit -m "chore(env): tambah DAILY_API_KEY untuk kelas online"
```

---

### Task 1: Skema database

**Files:**
- Modify: `prisma/schema.prisma` (model `Schedule`)

- [ ] **Step 1: Tambah field ke model `Schedule`** — sisipkan setelah baris `recurrenceWeeks   Int?`:

```prisma
  isOnline          Boolean               @default(false)
  durationMinutes   Int?
```

- [ ] **Step 2: Buat migration**

Run: `rtk npx prisma migrate dev --name schedule_online`
Expected: folder baru `prisma/migrations/<timestamp>_schedule_online/` berisi `ALTER TABLE "Schedule" ADD COLUMN "isOnline" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "durationMinutes" INTEGER;` dan Prisma Client ter-generate.

- [ ] **Step 3: Pastikan test lama tetap hijau**

Run: `rtk npx jest`
Expected: semua PASS (tidak ada perubahan perilaku).

- [ ] **Step 4: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 5: Commit**

```bash
rtk git add prisma/schema.prisma prisma/migrations
rtk git commit -m "feat(schedule): tambah isOnline & durationMinutes untuk kelas online"
```

---

### Task 2: Helper durasi & jendela waktu WIB

**Files:**
- Create: `lib/online-class.ts`
- Test: `__tests__/lib/online-class.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

```ts
import {
  parseDuration,
  durationFromSetting,
  addMinutesHHmm,
  scheduleWindow,
  joinWindowState,
  DEFAULT_ONLINE_DURATION_MIN,
} from '@/lib/online-class'

describe('parseDuration', () => {
  it.each([
    ['40', 40],
    [30, 30],
    ['10', 10],
    ['180', 180],
  ])('%p → %p', (raw, expected) => expect(parseDuration(raw)).toBe(expected))

  it.each(['9', '181', '40.5', '', 'abc', null, undefined, -30])('%p → null', (raw) =>
    expect(parseDuration(raw)).toBeNull()
  )
})

describe('durationFromSetting', () => {
  it('pakai nilai setting kalau valid', () => expect(durationFromSetting('30')).toBe(30))
  it('fallback default kalau kosong', () => expect(durationFromSetting(undefined)).toBe(DEFAULT_ONLINE_DURATION_MIN))
  it('fallback default kalau rusak', () => expect(durationFromSetting('x')).toBe(DEFAULT_ONLINE_DURATION_MIN))
})

describe('addMinutesHHmm', () => {
  it('14:00 + 40 = 14:40', () => expect(addMinutesHHmm('14:00', 40)).toBe('14:40'))
  it('lintas jam 09:50 + 30 = 10:20', () => expect(addMinutesHHmm('09:50', 30)).toBe('10:20'))
  it('lewat tengah malam → null', () => expect(addMinutesHHmm('23:40', 30)).toBeNull())
  it('input rusak → null', () => expect(addMinutesHHmm('abc', 30)).toBeNull())
})

describe('scheduleWindow', () => {
  const expectedStart = Date.parse('2026-10-10T14:00:00+07:00')
  const expectedEnd = Date.parse('2026-10-10T14:40:00+07:00')

  it('date tersimpan UTC-midnight (form admin)', () => {
    const w = scheduleWindow(new Date('2026-10-10T00:00:00.000Z'), '14:00', '14:40')
    expect(w).toEqual({ startMs: expectedStart, endMs: expectedEnd })
  })

  it('date tersimpan WIB-midnight (+07:00)', () => {
    const w = scheduleWindow(new Date('2026-10-10T00:00:00+07:00'), '14:00', '14:40')
    expect(w).toEqual({ startMs: expectedStart, endMs: expectedEnd })
  })
})

describe('joinWindowState', () => {
  const start = Date.parse('2026-10-10T14:00:00+07:00')
  const end = Date.parse('2026-10-10T14:40:00+07:00')
  const at = (s: string) => Date.parse(`2026-10-10T${s}:00+07:00`)

  it('20 menit sebelum mulai → TOO_EARLY', () => expect(joinWindowState(at('13:40'), start, end)).toBe('TOO_EARLY'))
  it('10 menit sebelum mulai → OPEN (boleh masuk lebih awal)', () => expect(joinWindowState(at('13:50'), start, end)).toBe('OPEN'))
  it('di tengah sesi → OPEN', () => expect(joinWindowState(at('14:20'), start, end)).toBe('OPEN'))
  it('tepat jam selesai → ENDED', () => expect(joinWindowState(at('14:40'), start, end)).toBe('ENDED'))
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `rtk npx jest __tests__/lib/online-class.test.ts`
Expected: FAIL — `Cannot find module '@/lib/online-class'`.

- [ ] **Step 3: Implementasi**

`lib/online-class.ts`:

```ts
export const ONLINE_DURATION_KEY = 'ONLINE_CLASS_DURATION_MIN'
export const DEFAULT_ONLINE_DURATION_MIN = 40
export const MIN_ONLINE_DURATION_MIN = 10
export const MAX_ONLINE_DURATION_MIN = 180
export const EARLY_JOIN_MIN = 10

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

export function parseDuration(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < MIN_ONLINE_DURATION_MIN || n > MAX_ONLINE_DURATION_MIN) return null
  return n
}

export function durationFromSetting(raw: string | null | undefined): number {
  return parseDuration(raw) ?? DEFAULT_ONLINE_DURATION_MIN
}

// ponytail: jadwal yang lewat tengah malam ditolak (null), belum ada kebutuhan kelas malam.
export function addMinutesHHmm(hhmm: string, minutes: number): string | null {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + minutes
  if (!Number.isFinite(total) || total >= 24 * 60) return null
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// Schedule.date ada yang tersimpan UTC-midnight (form admin) dan ada yang WIB-midnight (+07:00).
// Geser +7 jam dulu supaya tanggal kalender WIB benar untuk kedua bentuk.
export function scheduleWindow(date: Date, startTime: string, endTime: string) {
  const wib = new Date(date.getTime() + WIB_OFFSET_MS)
  const dayStartMs = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - WIB_OFFSET_MS
  const toMs = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return dayStartMs + (h * 60 + m) * 60_000
  }
  return { startMs: toMs(startTime), endMs: toMs(endTime) }
}

export type JoinWindowState = 'TOO_EARLY' | 'OPEN' | 'ENDED'

export function joinWindowState(nowMs: number, startMs: number, endMs: number): JoinWindowState {
  if (nowMs < startMs - EARLY_JOIN_MIN * 60_000) return 'TOO_EARLY'
  if (nowMs >= endMs) return 'ENDED'
  return 'OPEN'
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `rtk npx jest __tests__/lib/online-class.test.ts`
Expected: PASS semua.

- [ ] **Step 5: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 6: Commit**

```bash
rtk git add lib/online-class.ts __tests__/lib/online-class.test.ts
rtk git commit -m "feat(online-class): helper durasi & jendela waktu WIB"
```

---

### Task 3: Klien Daily REST

**Files:**
- Create: `lib/daily.ts`
- Test: `__tests__/lib/daily.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

```ts
import { ensureRoom, createMeetingToken } from '@/lib/daily'

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fetchMock = jest.fn()
global.fetch = fetchMock as any

beforeEach(() => {
  fetchMock.mockReset()
  process.env.DAILY_API_KEY = 'test-key'
})

describe('ensureRoom', () => {
  it('room sudah ada → pakai url-nya, tidak create', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { url: 'https://x.daily.co/r1' }))
    await expect(ensureRoom('r1', 100, 200)).resolves.toBe('https://x.daily.co/r1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.daily.co/v1/rooms/r1')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-key')
  })

  it('room belum ada → create private dengan nbf/exp + eject', async () => {
    fetchMock
      .mockResolvedValueOnce(json(404, { error: 'not-found' }))
      .mockResolvedValueOnce(json(200, { url: 'https://x.daily.co/r1' }))
    await expect(ensureRoom('r1', 100, 200)).resolves.toBe('https://x.daily.co/r1')
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('https://api.daily.co/v1/rooms')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      name: 'r1',
      privacy: 'private',
      properties: { nbf: 100, exp: 200, eject_at_room_exp: true },
    })
  })

  it('race: create gagal karena sudah dibuat request lain → GET ulang', async () => {
    fetchMock
      .mockResolvedValueOnce(json(404, {}))
      .mockResolvedValueOnce(json(400, { info: 'already exists' }))
      .mockResolvedValueOnce(json(200, { url: 'https://x.daily.co/r1' }))
    await expect(ensureRoom('r1', 100, 200)).resolves.toBe('https://x.daily.co/r1')
  })

  it('gagal total → throw', async () => {
    fetchMock.mockResolvedValue(json(500, {}))
    await expect(ensureRoom('r1', 100, 200)).rejects.toThrow('Daily create room gagal')
  })

  it('API key kosong → throw jelas', async () => {
    delete process.env.DAILY_API_KEY
    await expect(ensureRoom('r1', 100, 200)).rejects.toThrow('DAILY_API_KEY')
  })
})

describe('createMeetingToken', () => {
  it('token terikat room, exp + eject', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { token: 'tok' }))
    await expect(
      createMeetingToken({ roomName: 'r1', userName: 'Bu Sari', isOwner: true, expSec: 200 })
    ).resolves.toBe('tok')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.properties).toEqual({
      room_name: 'r1',
      user_name: 'Bu Sari',
      is_owner: true,
      exp: 200,
      eject_at_token_exp: true,
    })
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `rtk npx jest __tests__/lib/daily.test.ts`
Expected: FAIL — `Cannot find module '@/lib/daily'`.

- [ ] **Step 3: Implementasi**

`lib/daily.ts`:

```ts
// Semua kode spesifik provider video ada di sini + OnlineRoomClient.tsx.
// Ganti provider (mis. LiveKit) = ganti dua file itu saja.
const DAILY_API = 'https://api.daily.co/v1'

async function dailyFetch(path: string, init: { method?: string; body?: string } = {}) {
  const key = process.env.DAILY_API_KEY
  if (!key) throw new Error('DAILY_API_KEY belum di-set')
  return fetch(`${DAILY_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
}

export async function ensureRoom(name: string, nbfSec: number, expSec: number): Promise<string> {
  const existing = await dailyFetch(`/rooms/${name}`)
  if (existing.ok) return (await existing.json()).url

  const created = await dailyFetch('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name,
      privacy: 'private',
      properties: {
        nbf: nbfSec,
        exp: expSec,
        eject_at_room_exp: true,
        max_participants: 20,
        enable_prejoin_ui: true,
      },
    }),
  })
  if (created.ok) return (await created.json()).url

  // Dua orang join bersamaan: request lain sudah membuat room yang sama.
  const retry = await dailyFetch(`/rooms/${name}`)
  if (retry.ok) return (await retry.json()).url
  throw new Error(`Daily create room gagal: ${created.status}`)
}

export async function createMeetingToken(opts: {
  roomName: string
  userName: string
  isOwner: boolean
  expSec: number
}): Promise<string> {
  const res = await dailyFetch('/meeting-tokens', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        room_name: opts.roomName,
        user_name: opts.userName,
        is_owner: opts.isOwner,
        exp: opts.expSec,
        eject_at_token_exp: true,
      },
    }),
  })
  if (!res.ok) throw new Error(`Daily token gagal: ${res.status}`)
  return (await res.json()).token
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `rtk npx jest __tests__/lib/daily.test.ts`
Expected: PASS semua.

- [ ] **Step 5: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 6: Commit**

```bash
rtk git add lib/daily.ts __tests__/lib/daily.test.ts
rtk git commit -m "feat(online-class): klien Daily REST (room private + token ber-exp)"
```

---

### Task 4: Setting durasi oleh SUPER_ADMIN

**Files:**
- Modify: `app/api/admin/settings/route.ts`
- Modify: `app/(dashboard)/admin/settings/page.tsx`
- Modify: `app/(dashboard)/admin/settings/SettingsClient.tsx`
- Test: `__tests__/api/admin-settings-online-duration.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

```ts
import { GET, PUT } from '@/app/api/admin/settings/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: { systemSetting: { findMany: jest.fn(), upsert: jest.fn() } },
}))

const asRole = (role: string) =>
  (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u', role } })
const putReq = (body: object) =>
  new NextRequest('http://localhost/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

describe('settings ONLINE_CLASS_DURATION_MIN', () => {
  beforeEach(() => jest.clearAllMocks())

  it('GET mengembalikan default 40', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([])
    const res = await GET(new NextRequest('http://localhost/api/admin/settings'))
    expect((await res.json()).ONLINE_CLASS_DURATION_MIN).toBe('40')
  })

  it('PUT 30 diterima', async () => {
    asRole('SUPER_ADMIN')
    ;(prisma.systemSetting.upsert as jest.Mock).mockResolvedValue({ key: 'ONLINE_CLASS_DURATION_MIN', value: '30' })
    const res = await PUT(putReq({ key: 'ONLINE_CLASS_DURATION_MIN', value: '30' }))
    expect(res.status).toBe(200)
  })

  it.each(['5', '181', '40.5', 'abc'])('PUT %p ditolak 400', async (value) => {
    asRole('SUPER_ADMIN')
    const res = await PUT(putReq({ key: 'ONLINE_CLASS_DURATION_MIN', value }))
    expect(res.status).toBe(400)
    expect(prisma.systemSetting.upsert).not.toHaveBeenCalled()
  })

  it('ADMIN tidak boleh ubah', async () => {
    asRole('ADMIN')
    const res = await PUT(putReq({ key: 'ONLINE_CLASS_DURATION_MIN', value: '30' }))
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `rtk npx jest __tests__/api/admin-settings-online-duration.test.ts`
Expected: FAIL — GET mengembalikan `undefined` untuk key itu; PUT `'5'` mengembalikan 200.

- [ ] **Step 3: Implementasi route** — di `app/api/admin/settings/route.ts`:

Tambah import di atas:

```ts
import { ONLINE_DURATION_KEY, DEFAULT_ONLINE_DURATION_MIN, parseDuration } from '@/lib/online-class'
```

Ganti `SETTING_DEFAULTS`:

```ts
const SETTING_DEFAULTS: Record<string, string> = {
  AUTO_TIMETABLE_BROADCAST: 'true',
  [ONLINE_DURATION_KEY]: String(DEFAULT_ONLINE_DURATION_MIN),
}
```

Di `PUT`, tepat setelah blok `if (typeof key !== 'string' || typeof value !== 'string') {...}` tambahkan:

```ts
  if (key === ONLINE_DURATION_KEY && parseDuration(value) === null) {
    return NextResponse.json({ error: 'Durasi kelas online harus bilangan bulat 10–180 menit' }, { status: 400 })
  }
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `rtk npx jest __tests__/api/admin-settings-online-duration.test.ts`
Expected: PASS.

- [ ] **Step 5: Server page kirim nilai awal** — di `app/(dashboard)/admin/settings/page.tsx`:

Tambah import:

```ts
import { ONLINE_DURATION_KEY, durationFromSetting } from '@/lib/online-class'
```

Setelah baris `const autoBroadcast = autoBroadcastSetting?.value !== 'false'` tambahkan:

```ts
  const onlineDurationSetting = await prisma.systemSetting.findUnique({ where: { key: ONLINE_DURATION_KEY } })
  const onlineDuration = durationFromSetting(onlineDurationSetting?.value)
```

Ganti baris return menjadi:

```tsx
  return (
    <SettingsClient
      initialStatus={initialStatus}
      initialAutoBroadcast={autoBroadcast}
      initialOnlineDuration={onlineDuration}
    />
  )
```

- [ ] **Step 6: Kartu UI di `SettingsClient.tsx`**

Ubah import lucide menjadi:

```ts
import { ExternalLink, RefreshCw, Wifi, WifiOff, Bell, BellOff, Video } from 'lucide-react'
```

Tambah ke `interface Props`:

```ts
  initialOnlineDuration: number
```

Ubah signature komponen:

```tsx
export default function SettingsClient({ initialStatus, initialAutoBroadcast, initialOnlineDuration }: Props) {
```

Tambah state di bawah state existing:

```ts
  const [onlineDuration, setOnlineDuration] = useState(String(initialOnlineDuration))
  const [savedOnlineDuration, setSavedOnlineDuration] = useState(initialOnlineDuration)
  const [savingDuration, setSavingDuration] = useState(false)
  const [durationError, setDurationError] = useState<string | null>(null)

  const saveOnlineDuration = async () => {
    setSavingDuration(true)
    setDurationError(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ONLINE_CLASS_DURATION_MIN', value: onlineDuration }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal menyimpan durasi.')
      setSavedOnlineDuration(Number(onlineDuration))
    } catch (err: any) {
      setDurationError(err.message)
    } finally {
      setSavingDuration(false)
    }
  }
```

Sisipkan kartu ini tepat sebelum komentar `{/* Auto-Broadcast Toggle */}`:

```tsx
      {/* Durasi Kelas Online */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-4">
        <div>
          <h2 className="font-extrabold text-slate-800 flex items-center gap-2">
            <Video className="h-4 w-4 text-indigo-600" />
            Durasi Kelas Online
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Dipakai sebagai durasi jadwal online baru. Saat waktu habis, semua peserta otomatis dikeluarkan dari ruang video.
            Jadwal yang sudah dibuat tidak berubah.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[30, 40, 60].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setOnlineDuration(String(m))}
              className={`text-sm font-semibold px-4 py-2 rounded-xl border cursor-pointer ${
                onlineDuration === String(m)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400'
              }`}
            >
              {m} menit
            </button>
          ))}
          <input
            type="number"
            min={10}
            max={180}
            value={onlineDuration}
            onChange={(e) => setOnlineDuration(e.target.value)}
            aria-label="Durasi custom (menit)"
            className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
          />
          <span className="text-sm text-slate-500">menit</span>
          <button
            type="button"
            onClick={saveOnlineDuration}
            disabled={savingDuration || onlineDuration === String(savedOnlineDuration)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
          >
            {savingDuration ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
        {durationError && <p className="text-xs font-semibold text-rose-600">{durationError}</p>}
        <p className="text-xs text-slate-500">
          Aktif sekarang: <strong>{savedOnlineDuration} menit</strong> (rentang 10–180)
        </p>
      </div>
```

- [ ] **Step 7: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 8: Commit**

```bash
rtk git add app/api/admin/settings/route.ts "app/(dashboard)/admin/settings" __tests__/api/admin-settings-online-duration.test.ts
rtk git commit -m "feat(settings): SUPER_ADMIN atur durasi default kelas online"
```

---

### Task 5: Buat & edit jadwal online (durasi dihitung server)

**Files:**
- Modify: `app/api/schedules/route.ts` (`createScheduleSchema`, `POST`)
- Modify: `app/api/schedules/[id]/route.ts` (`updateScheduleSchema`, `PUT`)
- Test: `__tests__/api/schedules-online-create.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

```ts
import { POST } from '@/app/api/schedules/route'
import { PUT } from '@/app/api/schedules/[id]/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/storage', () => ({ deleteFile: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    enrollment: { findMany: jest.fn() },
    systemSetting: { findUnique: jest.fn() },
    schedule: { create: jest.fn((args) => args), findUnique: jest.fn(), update: jest.fn((args) => args) },
    $transaction: jest.fn(async (ops) => ops),
  },
}))

const asRole = (role: string) =>
  (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'actor', role } })
const req = (url: string, method: string, body: object) =>
  new NextRequest(url, { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })

const base = {
  classId: 'c1',
  date: '2026-10-10',
  startTime: '14:00',
  topic: 'Sempoa',
  studentIds: ['s1'],
  isOnline: true,
}

describe('POST /api/schedules — online', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.enrollment.findMany as jest.Mock).mockResolvedValue([{ studentId: 's1' }])
    ;(prisma.systemSetting.findUnique as jest.Mock).mockResolvedValue({ value: '30' })
  })

  it('ADMIN: durasi dari setting, endTime dihitung server (endTime client diabaikan)', async () => {
    asRole('ADMIN')
    const res = await POST(req('http://localhost/api/schedules', 'POST', { ...base, endTime: '17:00', durationMinutes: 90 }))
    expect(res.status).toBe(201)
    const { data } = (await res.json()).schedules[0]
    expect(data).toMatchObject({ isOnline: true, durationMinutes: 30, endTime: '14:30' })
  })

  it('SUPER_ADMIN: boleh override durasi', async () => {
    asRole('SUPER_ADMIN')
    const res = await POST(req('http://localhost/api/schedules', 'POST', { ...base, durationMinutes: 45 }))
    const { data } = (await res.json()).schedules[0]
    expect(data).toMatchObject({ durationMinutes: 45, endTime: '14:45' })
  })

  it('setting kosong → default 40', async () => {
    asRole('ADMIN')
    ;(prisma.systemSetting.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await POST(req('http://localhost/api/schedules', 'POST', base))
    const { data } = (await res.json()).schedules[0]
    expect(data.endTime).toBe('14:40')
  })

  it('lewat tengah malam → 400', async () => {
    asRole('ADMIN')
    const res = await POST(req('http://localhost/api/schedules', 'POST', { ...base, startTime: '23:45' }))
    expect(res.status).toBe(400)
  })

  it('offline tetap wajib endTime', async () => {
    asRole('ADMIN')
    const res = await POST(req('http://localhost/api/schedules', 'POST', { ...base, isOnline: false }))
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/schedules/[id] — online', () => {
  const params = { params: Promise.resolve({ id: 'sch1' }) }
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.schedule.findUnique as jest.Mock).mockResolvedValue({
      id: 'sch1',
      isOnline: true,
      durationMinutes: 40,
      startTime: '14:00',
      endTime: '14:40',
      class: { tutorId: 't1', additionalTutors: [] },
    })
  })

  it('ADMIN geser jam mulai → endTime ikut, endTime client diabaikan', async () => {
    asRole('ADMIN')
    const res = await PUT(req('http://localhost/api/schedules/sch1', 'PUT', { startTime: '15:00', endTime: '18:00' }), params)
    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({ startTime: '15:00', endTime: '15:40', durationMinutes: 40 })
  })

  it('ADMIN kirim durationMinutes → diabaikan', async () => {
    asRole('ADMIN')
    const res = await PUT(req('http://localhost/api/schedules/sch1', 'PUT', { durationMinutes: 90 }), params)
    expect((await res.json()).data).toMatchObject({ endTime: '14:40', durationMinutes: 40 })
  })

  it('SUPER_ADMIN ubah durasi → endTime ikut', async () => {
    asRole('SUPER_ADMIN')
    const res = await PUT(req('http://localhost/api/schedules/sch1', 'PUT', { durationMinutes: 60 }), params)
    expect((await res.json()).data).toMatchObject({ endTime: '15:00', durationMinutes: 60 })
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `rtk npx jest __tests__/api/schedules-online-create.test.ts`
Expected: FAIL — POST tanpa `endTime` → 400 dari zod; data tidak punya `isOnline`/`durationMinutes`.

- [ ] **Step 3: Implementasi POST** — `app/api/schedules/route.ts`

Tambah import:

```ts
import { ONLINE_DURATION_KEY, addMinutesHHmm, durationFromSetting, parseDuration } from '@/lib/online-class'
```

Ganti `createScheduleSchema`:

```ts
const createScheduleSchema = z
  .object({
    classId: z.string().min(1),
    date: z.string().min(1),
    startTime: z.string().min(1),
    endTime: z.string().optional(),
    topic: z.string().optional(),
    location: z.string().optional(),
    studentIds: z.array(z.string().min(1)).min(1, 'Pilih minimal 1 siswa'),
    isRecurring: z.boolean().default(false),
    recurrenceWeeks: z.number().int().min(1).max(52).default(1),
    isOnline: z.boolean().default(false),
    durationMinutes: z.number().int().optional(),
  })
  .refine((d) => d.isOnline || !!d.endTime, { message: 'Jam selesai wajib diisi', path: ['endTime'] })
```

Di `POST`, ganti baris:

```ts
  const { studentIds, isRecurring, recurrenceWeeks, ...scheduleData } = parsed.data
```

dengan:

```ts
  const { studentIds, isRecurring, recurrenceWeeks, isOnline, durationMinutes: requestedDuration, endTime: requestedEnd, ...scheduleData } = parsed.data

  // Kelas online: durasi milik SUPER_ADMIN, jam selesai selalu dihitung server.
  let endTime = requestedEnd as string
  let durationMinutes: number | undefined
  if (isOnline) {
    const setting = await prisma.systemSetting.findUnique({ where: { key: ONLINE_DURATION_KEY } })
    durationMinutes =
      (role === 'SUPER_ADMIN' ? parseDuration(requestedDuration) : null) ?? durationFromSetting(setting?.value)
    const computed = addMinutesHHmm(scheduleData.startTime, durationMinutes)
    if (!computed) {
      return NextResponse.json({ error: 'Kelas online tidak boleh melewati pukul 24:00' }, { status: 400 })
    }
    endTime = computed
  }
```

Di dalam `prisma.schedule.create({ data: { ... } })`, ganti `...scheduleData,` dengan:

```ts
          ...scheduleData,
          endTime,
          isOnline,
          durationMinutes,
```

- [ ] **Step 4: Implementasi PUT** — `app/api/schedules/[id]/route.ts`

Tambah import:

```ts
import { DEFAULT_ONLINE_DURATION_MIN, addMinutesHHmm, parseDuration } from '@/lib/online-class'
```

Tambah ke `updateScheduleSchema`:

```ts
  durationMinutes: z.number().int().optional(),
```

Ganti baris `const { date, ...rest } = parsed.data` dengan:

```ts
  const { date, durationMinutes: requestedDuration, ...rest } = parsed.data

  // Kelas online: endTime selalu = startTime + durasi; hanya SUPER_ADMIN boleh ubah durasi.
  let onlineFields: { endTime: string; durationMinutes: number } | {} = {}
  if (existing.isOnline && role !== 'TUTOR') {
    const duration =
      (role === 'SUPER_ADMIN' ? parseDuration(requestedDuration) : null) ??
      existing.durationMinutes ??
      DEFAULT_ONLINE_DURATION_MIN
    const endTime = addMinutesHHmm(rest.startTime ?? existing.startTime, duration)
    if (!endTime) {
      return NextResponse.json({ error: 'Kelas online tidak boleh melewati pukul 24:00' }, { status: 400 })
    }
    onlineFields = { endTime, durationMinutes: duration }
  }
```

Ganti blok `updateData` dengan:

```ts
  const updateData =
    role === 'SUPER_ADMIN' || role === 'ADMIN'
      ? { ...rest, ...onlineFields, ...(date ? { date: new Date(date) } : {}) }
      : { topic: rest.topic, location: rest.location }
```

- [ ] **Step 5: Jalankan test baru + test schedule lama**

Run: `rtk npx jest __tests__/api/schedules-online-create.test.ts __tests__/api/schedules-publish-broadcast.test.ts`
Expected: PASS semua.

- [ ] **Step 6: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 7: Commit**

```bash
rtk git add app/api/schedules/route.ts "app/api/schedules/[id]/route.ts" __tests__/api/schedules-online-create.test.ts
rtk git commit -m "feat(schedule): jadwal online dengan durasi dikunci SUPER_ADMIN"
```

---

### Task 6: Endpoint join kelas online

**Files:**
- Create: `app/api/schedules/[id]/online/route.ts`
- Test: `__tests__/api/schedules-online-join.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

```ts
import { POST } from '@/app/api/schedules/[id]/online/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { ensureRoom, createMeetingToken } from '@/lib/daily'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/daily', () => ({ ensureRoom: jest.fn(), createMeetingToken: jest.fn() }))
jest.mock('@/lib/db', () => ({ prisma: { schedule: { findUnique: jest.fn() } } }))

const asUser = (role: string, id = 'u1', name = 'Pengguna') =>
  (getServerSession as jest.Mock).mockResolvedValue({ user: { id, role, name } })
const call = () =>
  POST(new NextRequest('http://localhost/api/schedules/sch1/online', { method: 'POST' }), {
    params: Promise.resolve({ id: 'sch1' }),
  })
const nowWIB = (hhmm: string) =>
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse(`2026-10-10T${hhmm}:00+07:00`))

const schedule = (over: object = {}) => ({
  id: 'sch1',
  isOnline: true,
  status: 'PUBLISHED',
  date: new Date('2026-10-10T00:00:00.000Z'),
  startTime: '14:00',
  endTime: '14:40',
  class: { tutorId: 't1', additionalTutors: [{ tutorId: 't2' }] },
  participants: [
    { student: { name: 'Andi', parentId: 'p1' } },
    { student: { name: 'Budi', parentId: 'p1' } },
    { student: { name: 'Citra', parentId: 'p2' } },
  ],
  ...over,
})

const startSec = Date.parse('2026-10-10T14:00:00+07:00') / 1000
const endSec = Date.parse('2026-10-10T14:40:00+07:00') / 1000

describe('POST /api/schedules/[id]/online', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
    ;(prisma.schedule.findUnique as jest.Mock).mockResolvedValue(schedule())
    ;(ensureRoom as jest.Mock).mockResolvedValue('https://mellyna.daily.co/room')
    ;(createMeetingToken as jest.Mock).mockResolvedValue('tok')
    nowWIB('14:05')
  })

  it('tanpa session → 401', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    expect((await call()).status).toBe(401)
  })

  it('jadwal bukan online → 404', async () => {
    asUser('TUTOR', 't1')
    ;(prisma.schedule.findUnique as jest.Mock).mockResolvedValue(schedule({ isOnline: false }))
    expect((await call()).status).toBe(404)
  })

  it('jadwal DRAFT → 409', async () => {
    asUser('TUTOR', 't1')
    ;(prisma.schedule.findUnique as jest.Mock).mockResolvedValue(schedule({ status: 'DRAFT' }))
    expect((await call()).status).toBe(409)
  })

  it('tutor kelas → owner, room & token sesuai jendela', async () => {
    asUser('TUTOR', 't1', 'Bu Sari')
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      url: 'https://mellyna.daily.co/room',
      token: 'tok',
      endsAt: new Date(endSec * 1000).toISOString(),
    })
    const roomName = `mly-sch1-${startSec}-${endSec}`
    expect(ensureRoom).toHaveBeenCalledWith(roomName, startSec - 10 * 60, endSec)
    expect(createMeetingToken).toHaveBeenCalledWith({ roomName, userName: 'Bu Sari', isOwner: true, expSec: endSec })
  })

  it('tutor tambahan → boleh', async () => {
    asUser('TUTOR', 't2')
    expect((await call()).status).toBe(200)
  })

  it('tutor lain → 403', async () => {
    asUser('TUTOR', 't9')
    expect((await call()).status).toBe(403)
    expect(ensureRoom).not.toHaveBeenCalled()
  })

  it('wali dengan 2 anak → nama gabungan, bukan owner', async () => {
    asUser('PARENT', 'p1')
    await call()
    expect(createMeetingToken).toHaveBeenCalledWith(
      expect.objectContaining({ userName: 'Andi & Budi', isOwner: false })
    )
  })

  it('wali tanpa anak di jadwal → 403', async () => {
    asUser('PARENT', 'p9')
    expect((await call()).status).toBe(403)
  })

  it('ADMIN → owner dengan label Admin', async () => {
    asUser('ADMIN', 'a1', 'Rina')
    await call()
    expect(createMeetingToken).toHaveBeenCalledWith(expect.objectContaining({ userName: 'Rina (Admin)', isOwner: true }))
  })

  it('terlalu awal → 409, room tidak dibuat', async () => {
    asUser('TUTOR', 't1')
    nowWIB('13:40')
    expect((await call()).status).toBe(409)
    expect(ensureRoom).not.toHaveBeenCalled()
  })

  it('10 menit sebelum mulai → boleh', async () => {
    asUser('TUTOR', 't1')
    nowWIB('13:50')
    expect((await call()).status).toBe(200)
  })

  it('sudah berakhir → 410', async () => {
    asUser('PARENT', 'p1')
    nowWIB('14:40')
    expect((await call()).status).toBe(410)
  })

  it('Daily error → 502', async () => {
    asUser('TUTOR', 't1')
    ;(ensureRoom as jest.Mock).mockRejectedValue(new Error('down'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    expect((await call()).status).toBe(502)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `rtk npx jest __tests__/api/schedules-online-join.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/schedules/[id]/online/route'`.

- [ ] **Step 3: Implementasi** — `app/api/schedules/[id]/online/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ensureRoom, createMeetingToken } from '@/lib/daily'
import { EARLY_JOIN_MIN, joinWindowState, scheduleWindow } from '@/lib/online-class'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const displayName = session.user?.name ?? 'Pengguna'
  const { id } = await params

  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: {
      class: { select: { tutorId: true, additionalTutors: { select: { tutorId: true } } } },
      participants: { select: { student: { select: { name: true, parentId: true } } } },
    },
  })
  if (!schedule || !schedule.isOnline) {
    return NextResponse.json({ error: 'Kelas online tidak ditemukan' }, { status: 404 })
  }
  if (schedule.status !== 'PUBLISHED' && schedule.status !== 'COMPLETED') {
    return NextResponse.json({ error: 'Kelas belum diterbitkan atau dibatalkan' }, { status: 409 })
  }

  let userName: string
  let isOwner = false
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
    userName = `${displayName} (Admin)`
    isOwner = true
  } else if (role === 'TUTOR') {
    const isClassTutor =
      schedule.class.tutorId === userId || schedule.class.additionalTutors.some((t) => t.tutorId === userId)
    if (!isClassTutor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    userName = displayName
    isOwner = true
  } else if (role === 'PARENT') {
    const children = schedule.participants.filter((p) => p.student.parentId === userId).map((p) => p.student.name)
    if (children.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    userName = children.join(' & ')
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { startMs, endMs } = scheduleWindow(schedule.date, schedule.startTime, schedule.endTime)
  const state = joinWindowState(Date.now(), startMs, endMs)
  if (state === 'TOO_EARLY') {
    return NextResponse.json(
      { error: `Kelas dibuka ${EARLY_JOIN_MIN} menit sebelum pukul ${schedule.startTime} WIB` },
      { status: 409 }
    )
  }
  if (state === 'ENDED') {
    return NextResponse.json({ error: 'Kelas online sudah berakhir' }, { status: 410 })
  }

  const startSec = Math.floor(startMs / 1000)
  const expSec = Math.floor(endMs / 1000)
  // Jam berubah → nama room berubah → room baru dengan exp baru.
  const roomName = `mly-${schedule.id}-${startSec}-${expSec}`

  try {
    const url = await ensureRoom(roomName, startSec - EARLY_JOIN_MIN * 60, expSec)
    const token = await createMeetingToken({ roomName, userName, isOwner, expSec })
    return NextResponse.json({ url, token, endsAt: new Date(endMs).toISOString() })
  } catch (err) {
    console.error('[Online Class] Daily error:', err)
    return NextResponse.json({ error: 'Layanan video sedang bermasalah, coba lagi sebentar' }, { status: 502 })
  }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `rtk npx jest __tests__/api/schedules-online-join.test.ts`
Expected: PASS semua.

- [ ] **Step 5: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 6: Commit**

```bash
rtk git add "app/api/schedules/[id]/online/route.ts" __tests__/api/schedules-online-join.test.ts
rtk git commit -m "feat(online-class): endpoint join dengan otorisasi & jendela waktu"
```

---

### Task 7: Buka izin kamera/mic untuk Daily (security headers)

**Files:**
- Modify: `next.config.ts`

Saat ini `Permissions-Policy: camera=(), microphone=()` memblok kamera/mic untuk semua frame — video tidak akan pernah jalan tanpa perubahan ini. Izin dibuka **hanya** untuk origin Daily milik Mellyna, bukan wildcard.

- [ ] **Step 1: Tambah konstanta** di atas `const securityHeaders`, ganti `mellyna` dengan subdomain dari Task 0:

```ts
// Origin room video kelas online (subdomain akun Daily, lihat Task 0 plan kelas online).
const DAILY_ORIGIN = 'https://mellyna.daily.co'
```

- [ ] **Step 2: Ganti entri Permissions-Policy**:

```ts
  {
    key: 'Permissions-Policy',
    value: `camera=(self "${DAILY_ORIGIN}"), microphone=(self "${DAILY_ORIGIN}"), display-capture=(self "${DAILY_ORIGIN}"), geolocation=(self)`,
  },
```

- [ ] **Step 3: Tambah Daily ke CSP** — ganti baris `frame-src`:

```ts
      `frame-src https://app.sandbox.midtrans.com https://app.midtrans.com ${DAILY_ORIGIN}`,
```

- [ ] **Step 4: Build untuk memastikan config valid**

Run: `rtk next build`
Expected: build sukses.

- [ ] **Step 5: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 6: Commit**

```bash
rtk git add next.config.ts
rtk git commit -m "feat(security): izinkan kamera/mic hanya untuk origin Daily"
```

---

### Task 8: Halaman ruang kelas online

**Files:**
- Create: `app/(dashboard)/kelas-online/[id]/page.tsx`
- Create: `app/(dashboard)/kelas-online/[id]/OnlineRoomClient.tsx`

Layout `(dashboard)` sudah redirect ke `/login` kalau tidak ada session; otorisasi per jadwal dilakukan endpoint Task 6. Middleware tidak perlu diubah.

- [ ] **Step 1: Install SDK**

Run: `rtk npm install @daily-co/daily-js`
Expected: `package.json` & `package-lock.json` bertambah `@daily-co/daily-js`. (Dockerfile memakai `npm install` — lockfile npm yang dipakai.)

- [ ] **Step 2: Server page** — `app/(dashboard)/kelas-online/[id]/page.tsx`:

```tsx
import OnlineRoomClient from './OnlineRoomClient'

export default async function OnlineClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OnlineRoomClient scheduleId={id} />
}
```

- [ ] **Step 3: Client** — `app/(dashboard)/kelas-online/[id]/OnlineRoomClient.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import DailyIframe, { type DailyCall } from '@daily-co/daily-js'
import { Clock } from 'lucide-react'

export default function OnlineRoomClient({ scheduleId }: { scheduleId: string }) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let frame: DailyCall | null = null
    let cancelled = false

    ;(async () => {
      const res = await fetch(`/api/schedules/${scheduleId}/online`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      // cancelled: StrictMode dev memanggil effect 2x; jangan buat 2 frame Daily.
      if (cancelled) return
      if (!res.ok) {
        setError(data.error ?? 'Gagal masuk kelas online.')
        return
      }
      setEndsAt(new Date(data.endsAt).getTime())
      frame = DailyIframe.createFrame(containerRef.current!, {
        showLeaveButton: true,
        iframeStyle: { width: '100%', height: '100%', border: '0', borderRadius: '16px' },
      })
      frame.on('left-meeting', () => router.back())
      await frame.join({ url: data.url, token: data.token })
    })().catch(() => {
      if (!cancelled) setError('Gagal memuat video. Periksa koneksi lalu muat ulang halaman.')
    })

    return () => {
      cancelled = true
      frame?.destroy()
    }
  }, [scheduleId, router])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const remainingMs = endsAt ? Math.max(0, endsAt - now) : null
  const mm = remainingMs !== null ? String(Math.floor(remainingMs / 60_000)).padStart(2, '0') : '--'
  const ss = remainingMs !== null ? String(Math.floor((remainingMs % 60_000) / 1000)).padStart(2, '0') : '--'
  const almostOver = remainingMs !== null && remainingMs <= 5 * 60_000

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-slate-800 dark:text-white">🎥 Kelas Online</h1>
        {endsAt && (
          <span
            className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full ${
              almostOver ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
            }`}
          >
            <Clock className="h-4 w-4" />
            Sisa {mm}:{ss}
          </span>
        )}
      </div>
      {almostOver && (
        <p className="text-xs font-semibold text-rose-600">Kelas akan otomatis berakhir saat waktu habis.</p>
      )}
      {error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : (
        <div ref={containerRef} className="w-full h-[75vh] rounded-2xl bg-slate-900" />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

Run: `rtk tsc --noEmit`
Expected: tidak ada error baru di `app/(dashboard)/kelas-online/`.

- [ ] **Step 5: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 6: Commit**

```bash
rtk git add package.json package-lock.json "app/(dashboard)/kelas-online"
rtk git commit -m "feat(online-class): halaman ruang video dengan hitung mundur"
```

---

### Task 9: Tombol & form di UI existing

**Files:**
- Create: `components/dashboard/JoinOnlineButton.tsx`
- Modify: `app/(dashboard)/tutor/page.tsx`
- Modify: `components/dashboard/ParentScheduleList.tsx`
- Modify: `app/(dashboard)/admin/schedules/page.tsx`
- Modify: `app/(dashboard)/admin/schedules/SchedulesClient.tsx`

- [ ] **Step 1: Komponen tombol** — `components/dashboard/JoinOnlineButton.tsx`:

```tsx
import Link from 'next/link'

// ponytail: tombol selalu tampil untuk jadwal online; validasi jam dilakukan endpoint join.
export function JoinOnlineButton({ scheduleId }: { scheduleId: string }) {
  return (
    <Link
      href={`/kelas-online/${scheduleId}`}
      className="text-sm font-semibold px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer"
    >
      🎥 Masuk Kelas Online
    </Link>
  )
}
```

- [ ] **Step 2: Tutor dashboard** — `app/(dashboard)/tutor/page.tsx`

Tambah import:

```ts
import { JoinOnlineButton } from '@/components/dashboard/JoinOnlineButton'
```

Di dalam `<div className="flex gap-2">` (yang berisi link Absensi & Laporan), sisipkan sebagai anak pertama:

```tsx
                  {schedule.isOnline && schedule.status !== 'DRAFT' && schedule.status !== 'CANCELLED' && (
                    <JoinOnlineButton scheduleId={schedule.id} />
                  )}
```

(`schedule.isOnline` tersedia karena query memakai `include`, jadi semua kolom skalar ikut.)

- [ ] **Step 3: Wali murid** — `components/dashboard/ParentScheduleList.tsx`

Tambah import:

```ts
import { JoinOnlineButton } from '@/components/dashboard/JoinOnlineButton'
```

Tambah ke `interface Schedule`:

```ts
  isOnline: boolean
```

Sisipkan tepat setelah blok `{s.topic && ( ... )}` (masih di dalam `<div className="space-y-1.5 ...">`):

```tsx
                    {s.isOnline && (
                      <div className="pt-2">
                        <JoinOnlineButton scheduleId={s.id} />
                      </div>
                    )}
```

- [ ] **Step 4: Admin — kirim role & durasi default ke client** — `app/(dashboard)/admin/schedules/page.tsx`

Ganti seluruh isi file:

```tsx
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import { ONLINE_DURATION_KEY, durationFromSetting } from '@/lib/online-class'
import SchedulesClient from './SchedulesClient'

export default async function AdminSchedulesPage() {
  const [session, rawSchedules, classes, durationSetting] = await Promise.all([
    getSession(),
    prisma.schedule.findMany({
      include: {
        class: {
          include: {
            tutor: { select: { name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.class.findMany({
      select: {
        id: true,
        name: true,
        tutor: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.systemSetting.findUnique({ where: { key: ONLINE_DURATION_KEY } }),
  ])

  const schedules = rawSchedules.map((s) => ({
    id: s.id,
    date: s.date.toISOString(),
    startTime: s.startTime,
    endTime: s.endTime,
    topic: s.topic,
    status: s.status,
    isOnline: s.isOnline,
    class: {
      name: s.class.name,
      tutor: { name: s.class.tutor.name },
    },
  }))

  return (
    <SchedulesClient
      initialSchedules={schedules}
      classes={classes}
      isSuperAdmin={(session?.user as any)?.role === 'SUPER_ADMIN'}
      defaultOnlineDuration={durationFromSetting(durationSetting?.value)}
    />
  )
}
```

- [ ] **Step 5: Admin — form & badge** — `app/(dashboard)/admin/schedules/SchedulesClient.tsx`

Tambah ke `interface Schedule`:

```ts
  isOnline: boolean
```

Ganti `interface Props` dan signature:

```tsx
interface Props {
  initialSchedules: Schedule[]
  classes: ClassOption[]
  isSuperAdmin: boolean
  defaultOnlineDuration: number
}

export default function SchedulesClient({ initialSchedules, classes, isSuperAdmin, defaultOnlineDuration }: Props) {
```

Tambah state di bawah `const [recurrenceWeeks, setRecurrenceWeeks] = useState(12)`:

```ts
  const [isOnline, setIsOnline] = useState(false)
  const [onlineDuration, setOnlineDuration] = useState(defaultOnlineDuration)
```

Di `handleSubmit`, ganti `body: JSON.stringify(...)` dengan:

```ts
        body: JSON.stringify({
          ...form,
          isRecurring,
          recurrenceWeeks: isRecurring ? recurrenceWeeks : 1,
          isOnline,
          ...(isOnline && isSuperAdmin ? { durationMinutes: onlineDuration } : {}),
        }),
```

dan setelah `setRecurrenceWeeks(12)` di blok sukses tambahkan:

```ts
      setIsOnline(false)
      setOnlineDuration(defaultOnlineDuration)
```

Ganti array field input (yang berisi `Tanggal *`, `Jam Mulai *`, ...) dengan versi yang menyembunyikan `Jam Selesai` saat online:

```tsx
            {[
              { label: 'Tanggal *', key: 'date', type: 'date', placeholder: '' },
              { label: 'Jam Mulai *', key: 'startTime', type: 'time', placeholder: '' },
              ...(isOnline ? [] : [{ label: 'Jam Selesai *', key: 'endTime', type: 'time', placeholder: '' }]),
              { label: 'Topik/Materi', key: 'topic', type: 'text', placeholder: 'mis. Persamaan Linear' },
              ...(isOnline ? [] : [{ label: 'Lokasi', key: 'location', type: 'text', placeholder: 'mis. Ruang A' }]),
            ].map(({ label, key, type, placeholder }) => (
```

Sisipkan blok ini tepat sebelum `<div className="sm:col-span-2 lg:col-span-3">` yang berisi checkbox `isRecurring`:

```tsx
            <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-rose-100 bg-rose-50/50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isOnline"
                  checked={isOnline}
                  onChange={(e) => setIsOnline(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                />
                <label htmlFor="isOnline" className="text-sm font-semibold text-slate-700 cursor-pointer">
                  🎥 Kelas Online (video di aplikasi)
                </label>
              </div>
              {isOnline &&
                (isSuperAdmin ? (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-600">Durasi</label>
                    <input
                      type="number"
                      min={10}
                      max={180}
                      value={onlineDuration}
                      onChange={(e) => setOnlineDuration(Number(e.target.value))}
                      className="w-24 px-3 py-1.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs text-slate-500">menit — jam selesai dihitung otomatis</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Durasi {defaultOnlineDuration} menit (diatur Super Admin). Jam selesai dihitung otomatis.
                  </p>
                ))}
            </div>
```

Di kolom tabel yang merender `{row.original.startTime} – {row.original.endTime}`, tambahkan setelahnya:

```tsx
          {row.original.isOnline && (
            <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">ONLINE</span>
          )}
```

Juga di `fetchSchedules`, data dari `GET /api/schedules` sudah memuat `isOnline` (Prisma `include` mengembalikan semua skalar) — tidak perlu ubah.

- [ ] **Step 6: Typecheck + semua test**

Run: `rtk tsc --noEmit` lalu `rtk npx jest`
Expected: tidak ada error baru; semua test PASS.

- [ ] **Step 7: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 8: Commit**

```bash
rtk git add components/dashboard/JoinOnlineButton.tsx "app/(dashboard)/tutor/page.tsx" components/dashboard/ParentScheduleList.tsx "app/(dashboard)/admin/schedules"
rtk git commit -m "feat(online-class): form jadwal online & tombol masuk untuk tutor/wali"
```

---

### Task 10: Uji coba end-to-end (manual, wajib sebelum rilis)

Tidak ada kode. Jalankan di build produksi lokal (`rtk next build` lalu `npm start`) karena PWA & security header berbeda di dev.

- [ ] **Step 1:** SUPER_ADMIN → Pengaturan → set durasi **30 menit** → Simpan. Reload, pastikan tetap 30.
- [ ] **Step 2:** ADMIN → Jadwal → buat jadwal **online** hari ini, jam mulai = sekarang + 5 menit, 1 siswa. Pastikan field Jam Selesai hilang, tabel menampilkan `HH:mm – HH:mm+30` + badge ONLINE. Terbitkan.
- [ ] **Step 3:** Login TUTOR (browser 1) & PARENT siswa tsb (browser 2 / HP via PWA) → klik **🎥 Masuk Kelas Online**. Pastikan: prompt izin kamera/mic muncul, video dua arah jalan, nama wali tampil = nama anak, hitung mundur tampil.
- [ ] **Step 4:** Buka DevTools Console di halaman `/kelas-online/...`. **Jika ada pelanggaran CSP**, tambahkan origin yang disebut ke direktif terkait di `next.config.ts` (kandidat: `connect-src https://*.daily.co wss://*.daily.co`, `script-src https://c.daily.co`), build ulang, ulangi Step 3.
- [ ] **Step 5:** Login PARENT lain (anak tidak terdaftar di jadwal) → buka URL `/kelas-online/<id>` langsung → harus muncul pesan error (403), tanpa video.
- [ ] **Step 6:** Biarkan sesi sampai jam selesai → **kedua peserta otomatis dikeluarkan** dan halaman kembali. Coba masuk lagi → "Kelas online sudah berakhir".
- [ ] **Step 7:** Catat pemakaian data HP wali selama sesi (Pengaturan → Penggunaan data) untuk estimasi biaya kuota siswa; catat participant-minute di dashboard Daily dan bandingkan dengan asumsi A4.
- [ ] **Step 8: Report ke user**

Lapor: hasil tiap step (lulus/gagal), perubahan CSP tambahan bila ada (file + baris), angka data HP & participant-minute dari Step 7.

- [ ] **Step 9: Commit (hanya jika Step 4 mengubah `next.config.ts`)**

```bash
rtk git add next.config.ts
rtk git commit -m "fix(security): tambah origin Daily yang dibutuhkan ke CSP"
```

- [ ] **Step 10: Deploy** — tambahkan `DAILY_API_KEY` ke `.env` server Sumopod **sebelum** image baru di-pull (migration `schedule_online` jalan otomatis via `prisma migrate deploy` di command container).

---

## Sumber riset

- Daily room config (`exp`, `nbf`, `eject_at_room_exp`, `privacy`): https://docs.daily.co/reference/rest-api/rooms/config
- Daily meeting token config (`room_name`, `exp`, `eject_at_token_exp`, join via `join({url, token})`): https://docs.daily.co/reference/rest-api/meeting-tokens/config
- Daily `useRoomExp` (countdown/eject): https://docs.daily.co/reference/daily-react/use-room-exp
- Harga Daily (pihak ketiga, verifikasi ulang): https://costbench.com/software/video-conferencing/daily-co , https://trtc.io/blog/details/daily-co-pricing-2026
- LiveKit quotas (resmi): https://docs.livekit.io/home/cloud/quotas-and-limits/
- Harga LiveKit (pihak ketiga): https://trtc.io/blog/details/livekit-pricing-2026
- Batas 40 menit Zoom Basic & lisensi Meeting SDK: https://community.zoom.com/t5/Zoom-Meetings/Group-meeting-time-limit/m-p/129387 , https://devforum.zoom.us/t/help-me-understand-meeting-sdk-pricing/132697
