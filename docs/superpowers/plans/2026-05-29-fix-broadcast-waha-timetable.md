# Fix Broadcast WAHA Timetable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix WhatsApp broadcast timetable yang gagal silent karena WAHA session name mismatch dan poor error observability.

**Architecture:** Tiga layer fix: (1) revert session name ke `mellyna` yang konsisten dengan WAHA container, (2) improve error logging di `sendWhatsApp`/`sendWhatsAppFile` agar response body ikut dicatat, (3) tambah session health-check sebelum broadcast timetable agar gagal cepat dengan pesan jelas.

**Tech Stack:** Next.js 14 App Router, WAHA (devlikeapro/waha Community), TypeScript, Docker Compose

---

## Root Cause Analysis

### Bug 1 — Session Name Mismatch (CRITICAL)

| | Was | Now (broken) |
|---|---|---|
| `lib/waha.ts` default | `'mellyna'` | `'default'` |
| `.env` `WAHA_SESSION` | `"mellyna"` | `"default"` |
| `.env.example` | `"mellyna"` | `"mellyna"` (unchanged) |
| WAHA container session | `mellyna` | `mellyna` (unchanged) |

WAHA container tidak pernah di-rename. App sekarang kirim request ke session `default` yang tidak ada → WAHA returns 4xx → `res.ok = false` → `sendWhatsApp` returns `false` → **broadcast gagal diam-diam** karena fire-and-forget pattern.

### Bug 2 — Silent Failure / No Error Detail

`sendWhatsApp` hanya log ketika `catch` (network error), bukan ketika HTTP error (4xx/5xx). Response body WAHA yang berisi pesan error tidak pernah dicatat.

```typescript
// BUG: res.ok false = tidak ada log sama sekali
const res = await fetch(...)
return res.ok  // just returns false, silent
```

### Bug 3 — No Pre-Broadcast Session Validation

Broadcast timetable langsung loop send tanpa verifikasi session WAHA dalam status `WORKING`. Jika session disconnected/not-scanned, semua pesan gagal dengan silent failure.

---

## File Map

| File | Action | Tanggung Jawab |
|---|---|---|
| `lib/waha.ts` | Modify | Fix default session + improve error logging |
| `.env` | Modify | Revert `WAHA_SESSION="mellyna"` |
| `.env.example` | Verify | Sudah benar, tidak perlu ubah |
| `app/api/admin/timetable/generate/route.ts` | Modify | Tambah session pre-check sebelum broadcast |

---

## Task 1: Verify WAHA Container Session Name

**Files:**
- Read: `docker-compose.yml`
- Shell: `docker exec` ke WAHA container

- [ ] **Step 1: Check WAHA sessions via API**

```bash
curl -s http://localhost:3001/api/sessions \
  -H "X-Api-Key: mellyna-waha-secret" | jq '.[] | {name, status}'
```

Expected output: session dengan name `mellyna` dan status `WORKING` (atau `SCAN_QR_CODE` jika belum connect).

Jika WAHA tidak running:
```bash
docker compose ps
```

- [ ] **Step 2: Jika session `mellyna` tidak ada, buat session**

```bash
curl -s -X POST http://localhost:3001/api/sessions/start \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: mellyna-waha-secret" \
  -d '{"name":"mellyna"}'
```

Lalu scan QR di dashboard WAHA: http://localhost:3001/dashboard

---

## Task 2: Fix `.env` — Revert WAHA_SESSION

**Files:**
- Modify: `.env`

- [ ] **Step 1: Fix .env**

Ubah baris ini di `.env`:
```
WAHA_SESSION="default"
```
Menjadi:
```
WAHA_SESSION="mellyna"
```

- [ ] **Step 2: Verify .env.example sudah konsisten**

Cek `.env.example` baris WAHA section:
```
WAHA_SESSION="mellyna"
```
Tidak perlu ubah jika sudah `mellyna`.

---

## Task 3: Fix `lib/waha.ts` — Session Default + Error Logging

**Files:**
- Modify: `lib/waha.ts`

- [ ] **Step 1: Fix default session + add error logging untuk sendWhatsApp**

Ganti seluruh konten `lib/waha.ts`:

```typescript
const WAHA_BASE = process.env.WAHA_BASE_URL ?? 'http://localhost:3001'
const WAHA_KEY = process.env.WAHA_API_KEY ?? ''
const WAHA_SESSION = process.env.WAHA_SESSION ?? 'mellyna'

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function randomDelay(minMs = 3000, maxMs = 7000): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const chatId = `${phone.replace(/\D/g, '').replace(/^0/, '62')}@c.us`
  try {
    const res = await fetch(`${WAHA_BASE}/api/sendText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': WAHA_KEY },
      body: JSON.stringify({ session: WAHA_SESSION, chatId, text: message }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '(no body)')
      console.error(`[WAHA] sendText failed ${res.status} for ${chatId}: ${body}`)
      return false
    }
    return true
  } catch (e) {
    console.error('[WAHA] sendText network error:', e)
    return false
  }
}

export async function getSessionStatus(): Promise<string> {
  try {
    const res = await fetch(`${WAHA_BASE}/api/sessions/${WAHA_SESSION}`, {
      headers: { 'X-Api-Key': WAHA_KEY },
    })
    if (!res.ok) return 'UNKNOWN'
    const data = await res.json()
    return data.status ?? 'UNKNOWN'
  } catch {
    return 'OFFLINE'
  }
}

export async function sendWhatsAppFile(
  phone: string,
  base64Data: string,
  filename: string,
  mimetype: string,
  caption: string
): Promise<boolean> {
  const chatId = `${phone.replace(/\D/g, '').replace(/^0/, '62')}@c.us`
  try {
    const res = await fetch(`${WAHA_BASE}/api/sendFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': WAHA_KEY },
      body: JSON.stringify({
        session: WAHA_SESSION,
        chatId,
        file: {
          data: `data:${mimetype};base64,${base64Data}`,
          filename,
        },
        caption,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '(no body)')
      console.error(`[WAHA] sendFile failed ${res.status} for ${chatId}: ${body}`)
      return false
    }
    return true
  } catch (e) {
    console.error('[WAHA] sendFile network error:', e)
    return false
  }
}
```

- [ ] **Step 2: Commit fix**

```bash
git add lib/waha.ts
git commit -m "fix(waha): revert session default to mellyna, add HTTP error logging"
```

---

## Task 4: Add Session Pre-Check di Timetable Generate

**Files:**
- Modify: `app/api/admin/timetable/generate/route.ts`

- [ ] **Step 1: Import getSessionStatus dan tambah pre-check setelah auth**

Ganti baris import WAHA di `app/api/admin/timetable/generate/route.ts`:

```typescript
// Sebelum (baris 5):
import { sendWhatsApp, sleep, randomDelay } from '@/lib/waha'

// Sesudah:
import { sendWhatsApp, sleep, randomDelay, getSessionStatus } from '@/lib/waha'
```

- [ ] **Step 2: Tambah session check sebelum broadcast di dalam Promise.resolve().then**

Ganti blok `Promise.resolve().then(async () => {` di baris 141-185 menjadi:

```typescript
Promise.resolve().then(async () => {
  // Verify WAHA session is active before broadcasting
  const sessionStatus = await getSessionStatus()
  if (sessionStatus !== 'WORKING') {
    console.error(`[Timetable Auto-Broadcast] WAHA session not WORKING (status: ${sessionStatus}). Broadcast skipped for class ${c.name}.`)
    return
  }

  // Broadcast to parents
  for (const p of schedule.participants) {
    const parent = p.student.parent
    if (!parent.phone) continue

    const message = `Halo Bunda/Ayah ${parent.name},

Berikut adalah jadwal belajar rutin untuk ${p.student.name} besok:
🏫 Kelas: ${c.name}
👨‍🏫 Tutor: ${c.tutor.name}
🕐 Waktu: ${dateStr}, ${timeStr}
📍 Lokasi: Ruang Belajar Mellyna

Sistem secara otomatis menjadwalkan ${p.student.name} untuk hadir. Jika berhalangan (sakit/izin), silakan hubungi kami dengan membalas pesan ini atau ajukan di portal akademik.

Terima kasih,
Mellyna Education`

    console.log(`[Timetable Auto-Broadcast] Sending WhatsApp to parent ${parent.name} (${parent.phone})`)
    const sent = await sendWhatsApp(parent.phone, message)
    if (!sent) console.warn(`[Timetable Auto-Broadcast] Failed to send to parent ${parent.name} (${parent.phone})`)
    await sleep(randomDelay(3000, 7000))
  }

  // Broadcast to tutor
  if (c.tutor.phone) {
    const studentNames = schedule.participants.map(p => p.student.name).join(', ')
    const tutorMessage = `Halo ${c.tutor.name},

Jadwal mengajar rutin Anda telah diterbitkan secara otomatis dari Timetable:
🏫 Kelas: ${c.name}
🕐 Waktu: ${dateStr}, ${timeStr}
👥 Peserta (${schedule.participants.length} siswa): ${studentNames}

Silakan konfirmasi kehadiran siswa setelah sesi selesai melalui portal tutor.

Mellyna Education`

    console.log(`[Timetable Auto-Broadcast] Sending WhatsApp to tutor ${c.tutor.name} (${c.tutor.phone})`)
    const sent = await sendWhatsApp(c.tutor.phone, tutorMessage)
    if (!sent) console.warn(`[Timetable Auto-Broadcast] Failed to send to tutor ${c.tutor.name} (${c.tutor.phone})`)
    await sleep(randomDelay(3000, 7000))
  }
}).catch(err => {
  console.error('[Timetable Auto-Broadcast] Broadcast error:', err)
})
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/timetable/generate/route.ts
git commit -m "fix(timetable): add WAHA session pre-check before broadcast, improve failure logging"
```

---

## Task 5: Test Manual Broadcast

- [ ] **Step 1: Verifikasi WAHA session WORKING**

```bash
curl -s http://localhost:3001/api/sessions/mellyna \
  -H "X-Api-Key: mellyna-waha-secret" | jq '.status'
```

Expected: `"WORKING"`

- [ ] **Step 2: Test kirim 1 pesan manual**

```bash
curl -s -X POST http://localhost:3001/api/sendText \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: mellyna-waha-secret" \
  -d '{
    "session": "mellyna",
    "chatId": "628XXXXXXXXXX@c.us",
    "text": "Test broadcast fix - mellyna education"
  }'
```

Ganti `628XXXXXXXXXX` dengan nomor HP test. Expected: `{"id":"...", "timestamp":...}` tanpa error.

- [ ] **Step 3: Trigger timetable generate dari UI admin**

Buka admin panel → Timetable → Generate. Pilih tanggal Senin minggu depan.

Monitor server logs:
```
[Timetable Auto-Broadcast] Sending WhatsApp to parent ...
[Timetable Auto-Broadcast] Sending WhatsApp to tutor ...
```

Tidak boleh ada log `WAHA session not WORKING` atau `sendText failed`.

---

## Quick Checklist

Sebelum done, pastikan:

- [ ] `.env` sudah `WAHA_SESSION="mellyna"`
- [ ] `lib/waha.ts` default sudah `'mellyna'`
- [ ] `lib/waha.ts` log HTTP error status + body
- [ ] `timetable/generate/route.ts` ada session pre-check
- [ ] WAHA container session `mellyna` status `WORKING`
- [ ] Test send manual berhasil
- [ ] Broadcast timetable berhasil diterima di WA

---

## Catatan Diagnostik Tambahan

Jika setelah fix masih gagal, cek hal berikut:

**WAHA Community Edition Limitation:**
- Community edition (`devlikeapro/waha`) tidak support bulk send tanpa delay — sudah ada `randomDelay(3000, 7000)` jadi harusnya aman.
- Community tidak support semua WAHA Plus features, tapi `sendText` dasar tersedia.

**Phone number format:**
- Indonesian numbers: `08xxx` → `628xxx@c.us` ✓ (sudah handle di `sendWhatsApp`)
- Jika nomor dari DB sudah `62xxx` → jangan ada double replace

**WAHA container restart:**
Jika session hilang setelah restart, perlu mount volume `waha_data` yang sudah ada di `docker-compose.yml` — sudah benar.
