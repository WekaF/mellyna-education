# Fix WAHA WhatsApp QR Code Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memperbaiki masalah WAHA WhatsApp QR code scan yang tidak berhasil menghubungkan sesi, dengan memperbaiki konfigurasi Docker dan menambahkan kontrol sesi + tampilan QR langsung di admin UI.

**Architecture:** Ada 3 akar masalah: (1) volume Docker dipasang di `/tmp/waha-sessions` yang bisa ephemeral di beberapa setup, (2) tidak ada session auto-start sehingga sesi harus distart manual tiap container restart, (3) tidak ada QR display atau session control di admin UI sehingga alur scan membingungkan. Solusinya: perbaiki docker-compose, tambah endpoint backend untuk session management + QR fetch, dan embed QR + kontrol sesi di halaman Settings.

**Tech Stack:** Docker Compose, WAHA HTTP API, Next.js 14 App Router, TypeScript, Tailwind CSS

---

## Root Cause Analysis

Berdasarkan code review, ada 3 masalah utama:

### 1. Volume Path `/tmp/waha-sessions` (Kritis)
File: `docker-compose.yml` baris 51:
```yaml
volumes:
  - waha_data:/tmp/waha-sessions
```
Di beberapa Docker Desktop (terutama Mac), `/tmp` di dalam container adalah tmpfs (in-memory). Docker volume yang di-mount ke `/tmp` bisa tidak persist dengan benar karena layer ordering saat container boot. Session auth data WhatsApp (setelah scan QR) hilang saat container restart → harus scan ulang terus-menerus.

### 2. Tidak Ada Session Auto-Start
WAHA tidak menyediakan env var `WAHA_DEFAULT_SESSION` di docker-compose. Artinya tiap container restart, sesi harus distart manual dari WAHA dashboard (klik Start). Kalau sesi tidak di-start → tidak ada QR → scan tidak bisa.

### 3. Tidak Ada Feedback di Admin UI
Admin harus buka tab baru ke WAHA dashboard (http://localhost:3001), login lagi, lalu cari tombol Start/QR. Tidak ada cara melihat QR atau status real-time di admin app.

---

## File Structure

**Modified:**
- `docker-compose.yml` — perbaiki volume path + tambah env vars
- `lib/waha.ts` — tambah `startSession()`, `getQrCode()`
- `app/(dashboard)/admin/settings/SettingsClient.tsx` — tambah QR display + session controls + auto-poll

**Created:**
- `app/api/admin/waha/session/route.ts` — `POST` untuk start/stop sesi
- `app/api/admin/waha/qr/route.ts` — `GET` untuk fetch QR code dari WAHA

---

## Task 1: Fix Docker Compose — Volume Path dan Session Auto-Start

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Baca file saat ini**

```bash
cat docker-compose.yml
```

- [ ] **Step 2: Perbaiki volume mount path dan tambah env vars**

Ubah bagian `waha:` service di `docker-compose.yml` dari:

```yaml
  waha:
    image: devlikeapro/waha
    restart: unless-stopped
    environment:
      WHATSAPP_API_KEY: "mellyna-waha-secret"
      WHATSAPP_HOOK_URL: "http://host.docker.internal:3000/api/webhooks/waha"
      WHATSAPP_HOOK_EVENTS: "session.status"
      WAHA_DASHBOARD_USERNAME: "admin"
      WAHA_DASHBOARD_PASSWORD: "mellyna-waha-secret"
      WHATSAPP_HOOK_CUSTOM_HEADERS: "X-Api-Key:mellyna-waha-secret"
    ports:
      - "3001:3000"
    volumes:
      - waha_data:/tmp/waha-sessions
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

Menjadi:

```yaml
  waha:
    image: devlikeapro/waha
    restart: unless-stopped
    environment:
      WHATSAPP_API_KEY: "mellyna-waha-secret"
      WHATSAPP_HOOK_URL: "http://host.docker.internal:3000/api/webhooks/waha"
      WHATSAPP_HOOK_EVENTS: "session.status"
      WAHA_DASHBOARD_USERNAME: "admin"
      WAHA_DASHBOARD_PASSWORD: "mellyna-waha-secret"
      WHATSAPP_HOOK_CUSTOM_HEADERS: "X-Api-Key:mellyna-waha-secret"
      WHATSAPP_SESSIONS_PATH: "/app/waha-sessions"
      WAHA_LOG_LEVEL: "verbose"
    ports:
      - "3001:3000"
    volumes:
      - waha_data:/app/waha-sessions
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

Perubahan:
- `waha_data:/tmp/waha-sessions` → `waha_data:/app/waha-sessions` (non-tmpfs path)
- `WHATSAPP_SESSIONS_PATH: "/app/waha-sessions"` (eksplisit ke WAHA)
- `WAHA_LOG_LEVEL: "verbose"` (membantu debug)

- [ ] **Step 3: Restart WAHA container dengan konfigurasi baru**

```bash
docker compose stop waha && docker compose rm -f waha && docker compose up -d waha
```

- [ ] **Step 4: Verifikasi container berjalan**

```bash
docker compose ps waha
docker compose logs waha --tail=30
```

Expected: container status `Up`, log menampilkan WAHA startup tanpa error volume.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "fix: move WAHA session volume from /tmp to /app for reliable persistence"
```

---

## Task 2: Tambah Helper Functions di lib/waha.ts

**Files:**
- Modify: `lib/waha.ts`

- [ ] **Step 1: Baca file saat ini**

Baca `lib/waha.ts` untuk melihat isi lengkap sebelum edit.

- [ ] **Step 2: Tambah fungsi `startSession` dan `getQrCode`**

Tambahkan dua fungsi ini di akhir file `lib/waha.ts`, setelah fungsi `sendWhatsAppFile`:

```typescript
export async function startSession(): Promise<{ success: boolean; error?: string }> {
  try {
    // Try to start existing session first
    const startRes = await fetch(`${WAHA_BASE}/api/sessions/${WAHA_SESSION}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': WAHA_KEY },
    })
    if (startRes.ok) return { success: true }

    // If 404, session doesn't exist yet — create it first
    if (startRes.status === 404) {
      const createRes = await fetch(`${WAHA_BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': WAHA_KEY },
        body: JSON.stringify({ name: WAHA_SESSION, config: {} }),
      })
      if (!createRes.ok) {
        const body = await createRes.text().catch(() => '(no body)')
        return { success: false, error: `Create session failed ${createRes.status}: ${body}` }
      }
      // Now start it
      const startRes2 = await fetch(`${WAHA_BASE}/api/sessions/${WAHA_SESSION}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': WAHA_KEY },
      })
      if (startRes2.ok) return { success: true }
      const body = await startRes2.text().catch(() => '(no body)')
      return { success: false, error: `Start session failed ${startRes2.status}: ${body}` }
    }

    const body = await startRes.text().catch(() => '(no body)')
    return { success: false, error: `Start session failed ${startRes.status}: ${body}` }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function getQrCode(): Promise<string | null> {
  try {
    const res = await fetch(`${WAHA_BASE}/api/${WAHA_SESSION}/auth/qr?format=image`, {
      headers: { 'X-Api-Key': WAHA_KEY },
    })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const base64 = Buffer.from(buf).toString('base64')
    const contentType = res.headers.get('content-type') ?? 'image/png'
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Verifikasi TypeScript compile**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: tidak ada error di `lib/waha.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/waha.ts
git commit -m "feat: add startSession and getQrCode helpers to waha lib"
```

---

## Task 3: Buat API Route — Session Start/Stop

**Files:**
- Create: `app/api/admin/waha/session/route.ts`

- [ ] **Step 1: Pastikan direktori ada**

```bash
mkdir -p app/api/admin/waha/session
```

- [ ] **Step 2: Buat file route**

Buat file `app/api/admin/waha/session/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { startSession } from '@/lib/waha'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await startSession()
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Failed to start session' }, { status: 500 })
  }
  return NextResponse.json({ status: 'ok' })
}
```

- [ ] **Step 3: Verifikasi TypeScript compile**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: tidak ada error baru.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/waha/session/route.ts
git commit -m "feat: add POST /api/admin/waha/session to start WAHA session"
```

---

## Task 4: Buat API Route — QR Code

**Files:**
- Create: `app/api/admin/waha/qr/route.ts`

- [ ] **Step 1: Pastikan direktori ada**

```bash
mkdir -p app/api/admin/waha/qr
```

- [ ] **Step 2: Buat file route**

Buat file `app/api/admin/waha/qr/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getQrCode, getSessionStatus } from '@/lib/waha'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const status = await getSessionStatus()
  const qr = status === 'SCAN_QR_CODE' ? await getQrCode() : null

  return NextResponse.json({ status, qr })
}
```

- [ ] **Step 3: Verifikasi TypeScript compile**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: tidak ada error baru.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/waha/qr/route.ts
git commit -m "feat: add GET /api/admin/waha/qr to expose QR code for admin UI"
```

---

## Task 5: Update Admin Settings UI — QR Display + Session Controls + Auto-Poll

**Files:**
- Modify: `app/(dashboard)/admin/settings/SettingsClient.tsx`

- [ ] **Step 1: Baca file saat ini**

Baca `app/(dashboard)/admin/settings/SettingsClient.tsx` seluruhnya.

- [ ] **Step 2: Tambah state dan logic untuk QR + session control**

Ganti seluruh isi file dengan versi di bawah ini. Perubahan utama:
- Tambah state `qrData` (base64 QR image), `startingSession`, `wahaStatus`
- Tambah `useEffect` yang auto-poll `/api/admin/waha/qr` setiap 5 detik saat status `SCAN_QR_CODE` atau `STARTING`
- Tambah auto-poll status setiap 10 detik saat status bukan `WORKING`
- Tambah tombol "Start Sesi WhatsApp" yang memanggil `POST /api/admin/waha/session`
- Tampilkan QR code inline di UI saat status `SCAN_QR_CODE`

```tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ExternalLink, RefreshCw, Wifi, WifiOff, Bell, BellOff, Play, QrCode } from 'lucide-react'
import Image from 'next/image'

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

interface Props {
  initialStatus: IntegrationStatus | null
  initialAutoBroadcast: boolean
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

export default function SettingsClient({ initialStatus, initialAutoBroadcast }: Props) {
  const [status, setStatus] = useState<IntegrationStatus | null>(initialStatus)
  const [loading, setLoading] = useState(false)
  const [autoBroadcast, setAutoBroadcast] = useState(initialAutoBroadcast)
  const [savingBroadcast, setSavingBroadcast] = useState(false)
  const [qrData, setQrData] = useState<string | null>(null)
  const [wahaStatus, setWahaStatus] = useState<string>(initialStatus?.waha.status ?? 'UNKNOWN')
  const [startingSession, setStartingSession] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/status')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
        setWahaStatus(data.waha.status)
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchQr = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/waha/qr')
      if (!res.ok) return
      const data = await res.json()
      setWahaStatus(data.status)
      setQrData(data.qr ?? null)
      // Sync status badge in parent
      if (status) {
        setStatus(prev => prev ? { ...prev, waha: { ...prev.waha, status: data.status } } : prev)
      }
    } catch {}
  }, [status])

  // Auto-poll every 5s when waiting for QR or session start, 10s otherwise when not WORKING
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)

    if (wahaStatus === 'WORKING') return // no need to poll when connected

    const interval = (wahaStatus === 'SCAN_QR_CODE' || wahaStatus === 'STARTING') ? 5000 : 10000
    pollRef.current = setInterval(fetchQr, interval)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [wahaStatus, fetchQr])

  // Fetch QR immediately on mount if not WORKING
  useEffect(() => {
    if (wahaStatus !== 'WORKING') {
      fetchQr()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startSession = async () => {
    setStartingSession(true)
    try {
      const res = await fetch('/api/admin/waha/session', { method: 'POST' })
      if (res.ok) {
        setWahaStatus('STARTING')
        // Poll for QR immediately after starting
        setTimeout(fetchQr, 2000)
      } else {
        const data = await res.json().catch(() => ({}))
        console.error('[WAHA] Start session failed:', data.error)
      }
    } finally {
      setStartingSession(false)
    }
  }

  const toggleAutoBroadcast = async () => {
    const next = !autoBroadcast
    setSavingBroadcast(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'AUTO_TIMETABLE_BROADCAST', value: next ? 'true' : 'false' }),
      })
      if (res.ok) setAutoBroadcast(next)
    } finally {
      setSavingBroadcast(false)
    }
  }

  const isConnected = wahaStatus === 'WORKING'
  const needsScan = wahaStatus === 'SCAN_QR_CODE'
  const isStopped = wahaStatus === 'STOPPED' || wahaStatus === 'OFFLINE' || wahaStatus === 'UNKNOWN'

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">⚙️ Pengaturan &amp; Integrasi</h1>
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

      {/* Auto-Broadcast Toggle */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-extrabold text-slate-800 flex items-center gap-2">
              {autoBroadcast ? <Bell className="h-4 w-4 text-emerald-600" /> : <BellOff className="h-4 w-4 text-slate-400" />}
              Auto-Broadcast Jadwal Mingguan
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Saat aktif, cron otomatis akan membuat jadwal mingguan dan mengirim notifikasi WhatsApp ke semua orang tua &amp; tutor.
              Saat dimatikan, jadwal tetap dibuat oleh cron tapi WA tidak dikirim.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleAutoBroadcast}
            disabled={savingBroadcast}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
              autoBroadcast ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
            }`}
            role="switch"
            aria-checked={autoBroadcast}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                autoBroadcast ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <div className={`rounded-xl p-3 text-xs font-semibold ${autoBroadcast ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
          Status: <strong>{autoBroadcast ? '✅ Auto-broadcast AKTIF' : '🔕 Auto-broadcast DIMATIKAN'}</strong>
          {!autoBroadcast && ' — Cron akan tetap membuat jadwal tapi tidak mengirim WA.'}
        </div>
      </div>

      {/* WAHA Section */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-extrabold text-slate-800">📱 WAHA — WhatsApp HTTP API</h2>
            <p className="text-xs text-slate-500 mt-1">Layanan notifikasi WhatsApp otomatis ke orang tua siswa.</p>
          </div>
          <StatusBadge status={wahaStatus} />
        </div>

        {/* QR Code display — shown when session needs scan */}
        {needsScan && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-bold text-amber-700">Scan QR Code dengan WhatsApp</p>
            </div>
            {qrData ? (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white p-3 rounded-xl shadow-sm inline-block">
                  <Image src={qrData} alt="WAHA QR Code" width={220} height={220} unoptimized />
                </div>
                <p className="text-xs text-amber-600 text-center">
                  QR code otomatis refresh setiap 5 detik. Buka WhatsApp → Perangkat Tertaut → Tambahkan Perangkat → Scan.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Mengambil QR code...
              </div>
            )}
          </div>
        )}

        {/* Connected state */}
        {isConnected && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700 font-semibold flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            WhatsApp terhubung. Notifikasi siap dikirim.
          </div>
        )}

        {/* Setup instructions — shown when stopped/unknown */}
        {(isStopped || wahaStatus === 'STARTING') && !needsScan && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cara Setup Sesi WhatsApp</p>
            <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside">
              <li>Pastikan Docker container WAHA berjalan: <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">docker compose up -d waha</code></li>
              <li>Klik tombol <strong>Start Sesi WhatsApp</strong> di bawah</li>
              <li>QR code akan muncul di sini — scan dengan WhatsApp kamu</li>
              <li>Status akan berubah menjadi <strong>WORKING</strong> secara otomatis</li>
            </ol>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {/* Start session button — shown when not connected and not already scanning */}
          {!isConnected && (
            <button
              onClick={startSession}
              disabled={startingSession || wahaStatus === 'STARTING'}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {startingSession || wahaStatus === 'STARTING' ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {wahaStatus === 'STARTING' ? 'Memulai sesi...' : 'Start Sesi WhatsApp'}
            </button>
          )}

          {/* WAHA dashboard link */}
          {status && (
            <a
              href={status.waha.dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Buka Dashboard WAHA
            </a>
          )}
        </div>
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

- [ ] **Step 3: Verifikasi TypeScript compile**

```bash
npx tsc --noEmit 2>&1 | head -50
```

Expected: tidak ada error TypeScript. Jika ada error terkait `Image` dari `next/image`, pastikan `next.config.js` mengizinkan `data:` URLs atau ganti `Image` dengan `img` biasa.

- [ ] **Step 4: Jika ada error `next/image` dengan data URL**

Ganti bagian `<Image src={qrData} ... />` dengan:

```tsx
<img src={qrData} alt="WAHA QR Code" width={220} height={220} className="rounded" />
```

Dan hapus import `Image` dari `next/image`.

- [ ] **Step 5: Run dev server dan test manual**

```bash
npm run dev
```

Buka http://localhost:3000/admin/settings, verifikasi:
1. Status badge WAHA tampil
2. Tombol "Start Sesi WhatsApp" muncul saat status bukan WORKING
3. Setelah klik Start, status berubah ke STARTING
4. QR code muncul saat status SCAN_QR_CODE
5. Status auto-refresh (tidak perlu klik Refresh)

- [ ] **Step 6: Commit**

```bash
git add app/(dashboard)/admin/settings/SettingsClient.tsx
git commit -m "feat: embed QR code display and session controls in WAHA admin settings"
```

---

## Self-Review

### Spec Coverage
- ✅ Volume path fixed: `/tmp` → `/app/waha-sessions`
- ✅ `WHATSAPP_SESSIONS_PATH` env var eksplisit di docker-compose
- ✅ `startSession()` helper yang handle create+start session
- ✅ `getQrCode()` helper yang fetch QR dari WAHA API
- ✅ `POST /api/admin/waha/session` — secure endpoint (SUPER_ADMIN only)
- ✅ `GET /api/admin/waha/qr` — returns status + QR data
- ✅ Admin UI: QR display, auto-poll, session start button
- ✅ Auto-poll 5s saat SCAN_QR_CODE, 10s saat status lain yang non-WORKING

### Placeholder Scan
- Tidak ada TBD, TODO, atau "add validation" tanpa implementasi
- Semua code blocks lengkap

### Type Consistency
- `getQrCode()` returns `string | null` ✓
- `startSession()` returns `{ success: boolean; error?: string }` ✓
- API response `{ status, qr }` dikonsumsi dengan benar di frontend ✓
- `wahaStatus` state string dipakai konsisten (`WORKING`, `SCAN_QR_CODE`, `STARTING`, `STOPPED`, `OFFLINE`, `UNKNOWN`) ✓
