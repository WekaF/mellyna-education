# Timetable Auto-Broadcast Settings Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow superadmin to toggle auto-broadcast on/off for the weekly timetable cron job. When OFF, the cron still creates schedules but skips sending WhatsApp notifications.

**Architecture:** Add a `SystemSetting` Prisma model (key-value store). Cron job reads `AUTO_TIMETABLE_BROADCAST` setting before broadcasting — defaults to `true` if not set. Superadmin toggles this from the Settings page via a new API (`PUT /api/admin/settings`). Settings page fetches current value server-side and passes as prop. No changes to the manual generate route (manual always broadcasts — user explicitly triggered it).

**Tech Stack:** Next.js 14 App Router, Prisma, React, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `SystemSetting` model |
| `app/api/admin/settings/route.ts` | New: GET all settings, PUT upsert a setting |
| `app/(dashboard)/admin/settings/page.tsx` | Fetch `AUTO_TIMETABLE_BROADCAST` server-side, pass to client |
| `app/(dashboard)/admin/settings/SettingsClient.tsx` | Add auto-broadcast toggle section |
| `app/api/cron/timetable-generate/route.ts` | Check setting before broadcasting |
| `__tests__/api/admin/settings.test.ts` | New: GET/PUT settings API tests |
| `__tests__/api/cron/timetable-auto-broadcast-toggle.test.ts` | New: cron skips WA when setting is false |

---

### Task 1: Add `SystemSetting` Prisma model and run migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add model to schema**

Open `prisma/schema.prisma` and add at the end of the file:

```prisma
model SystemSetting {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_system_settings
```

Expected output:
```
✔ Your database is now in sync with your schema.
```

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: no errors. `prisma.systemSetting` should be available.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add SystemSetting model for runtime config"
```

---

### Task 2: Add settings API (GET + PUT)

**Files:**
- Create: `app/api/admin/settings/route.ts`
- Create: `__tests__/api/admin/settings.test.ts`

**Context:**
GET returns all settings as `{ AUTO_TIMETABLE_BROADCAST: 'true' }` — fills in defaults for any keys not in DB. PUT upserts a single setting by key. Both require SUPER_ADMIN role.

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/admin/settings.test.ts`:

```typescript
import { GET, PUT } from '@/app/api/admin/settings/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'

jest.mock('next-auth')
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/db', () => ({
  prisma: {
    systemSetting: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

const mockSession = { user: { role: 'SUPER_ADMIN' } }

describe('GET /api/admin/settings', () => {
  it('returns defaults when no settings in DB', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([])

    const req = new Request('http://localhost/api/admin/settings')
    const res = await GET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.AUTO_TIMETABLE_BROADCAST).toBe('true')
  })

  it('returns DB value when setting exists', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.systemSetting.findMany as jest.Mock).mockResolvedValue([
      { key: 'AUTO_TIMETABLE_BROADCAST', value: 'false', updatedAt: new Date() },
    ])

    const req = new Request('http://localhost/api/admin/settings')
    const res = await GET(req as any)
    const data = await res.json()

    expect(data.AUTO_TIMETABLE_BROADCAST).toBe('false')
  })

  it('returns 403 for non-admin', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'TUTOR' } })
    const req = new Request('http://localhost/api/admin/settings')
    const res = await GET(req as any)
    expect(res.status).toBe(403)
  })
})

describe('PUT /api/admin/settings', () => {
  it('upserts setting and returns it', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.systemSetting.upsert as jest.Mock).mockResolvedValue({
      key: 'AUTO_TIMETABLE_BROADCAST', value: 'false', updatedAt: new Date(),
    })

    const req = new Request('http://localhost/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'AUTO_TIMETABLE_BROADCAST', value: 'false' }),
    })
    const res = await PUT(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.key).toBe('AUTO_TIMETABLE_BROADCAST')
    expect(data.value).toBe('false')
  })

  it('returns 400 when key or value missing', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)

    const req = new Request('http://localhost/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'AUTO_TIMETABLE_BROADCAST' }),
    })
    const res = await PUT(req as any)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/api/admin/settings.test.ts --no-coverage
```

Expected: FAIL — route file doesn't exist yet

- [ ] **Step 3: Create the settings API route**

Create `app/api/admin/settings/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const SETTING_DEFAULTS: Record<string, string> = {
  AUTO_TIMETABLE_BROADCAST: 'true',
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const rows = await prisma.systemSetting.findMany()
  const result: Record<string, string> = { ...SETTING_DEFAULTS }
  for (const row of rows) result[row.key] = row.value
  return NextResponse.json(result)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { key, value } = body as Record<string, unknown>
  if (typeof key !== 'string' || typeof value !== 'string') {
    return NextResponse.json({ error: 'key and value must be strings' }, { status: 400 })
  }
  const setting = await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
  return NextResponse.json(setting)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/api/admin/settings.test.ts --no-coverage
```

Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/settings/route.ts __tests__/api/admin/settings.test.ts
git commit -m "feat: add SystemSetting GET/PUT API"
```

---

### Task 3: Add auto-broadcast toggle to Settings UI

**Files:**
- Modify: `app/(dashboard)/admin/settings/page.tsx`
- Modify: `app/(dashboard)/admin/settings/SettingsClient.tsx`

**Context:**
`page.tsx` is a server component that fetches WAHA/n8n status and passes it to `SettingsClient`. We extend it to also fetch the `AUTO_TIMETABLE_BROADCAST` setting. `SettingsClient` gets a new `autoBroadcast` prop and renders a toggle section.

- [ ] **Step 1: Fetch setting server-side in page.tsx**

Replace `app/(dashboard)/admin/settings/page.tsx` entirely:

```typescript
import { getSessionStatus } from '@/lib/waha'
import { prisma } from '@/lib/db'
import SettingsClient from './SettingsClient'

export default async function AdminSettingsPage() {
  const wahaStatus = await getSessionStatus()

  let n8nStatus = 'OFFLINE'
  try {
    const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL?.replace('/webhook', '') ?? 'http://localhost:5678'
    const res = await fetch(`${n8nUrl}/healthz`, { signal: AbortSignal.timeout(3000) })
    n8nStatus = res.ok ? 'ONLINE' : 'ERROR'
  } catch {
    n8nStatus = 'OFFLINE'
  }

  const autoBroadcastSetting = await prisma.systemSetting.findFirst({
    where: { key: 'AUTO_TIMETABLE_BROADCAST' },
  })
  const autoBroadcast = autoBroadcastSetting?.value !== 'false'

  const initialStatus = {
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
  }

  return <SettingsClient initialStatus={initialStatus} initialAutoBroadcast={autoBroadcast} />
}
```

- [ ] **Step 2: Add toggle UI to SettingsClient.tsx**

Update `app/(dashboard)/admin/settings/SettingsClient.tsx`. Add `initialAutoBroadcast: boolean` to Props, and a toggle section.

At the top, add `Toggle` state. Update the `Props` interface and add toggle state + save handler, then add the UI section.

Full updated file:

```typescript
'use client'

import { useState } from 'react'
import { ExternalLink, RefreshCw, Wifi, WifiOff, Bell, BellOff } from 'lucide-react'

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

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/status')
      if (res.ok) setStatus(await res.json())
    } finally {
      setLoading(false)
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
              {autoBroadcast ? <Bell className="h-4.5 w-4.5 text-emerald-600" /> : <BellOff className="h-4.5 w-4.5 text-slate-400" />}
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

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/admin/settings/page.tsx app/(dashboard)/admin/settings/SettingsClient.tsx
git commit -m "feat: add auto-broadcast toggle to settings page"
```

---

### Task 4: Cron job checks auto-broadcast setting before sending WA

**Files:**
- Modify: `app/api/cron/timetable-generate/route.ts`
- Create: `__tests__/api/cron/timetable-auto-broadcast-toggle.test.ts`

**Context:**
The cron generates schedules then broadcasts WA in a `Promise.resolve().then()` fire-and-forget per class. We check the `SystemSetting AUTO_TIMETABLE_BROADCAST` once before the main loop and use it as a flag to skip the fire-and-forget.

- [ ] **Step 1: Write failing test**

Create `__tests__/api/cron/timetable-auto-broadcast-toggle.test.ts`:

```typescript
import { GET } from '@/app/api/cron/timetable-generate/route'
import { prisma } from '@/lib/db'
import * as waha from '@/lib/waha'

jest.mock('@/lib/waha', () => ({
  sendWhatsApp: jest.fn(),
  sleep: jest.fn(),
  randomDelay: jest.fn().mockReturnValue(0),
}))
jest.mock('@/lib/db', () => ({
  prisma: {
    class: { findMany: jest.fn() },
    schedule: { findFirst: jest.fn(), create: jest.fn() },
    systemSetting: { findFirst: jest.fn() },
  },
}))

const CRON_SECRET = 'change-this-to-random-secret'
const cronUrl = `http://localhost/api/cron/timetable-generate?secret=${CRON_SECRET}`

function makeClass(id: string) {
  return {
    id,
    name: `Kelas ${id}`,
    dayOfWeek: 'MONDAY',
    timeSlot: '08:00',
    tutor: { name: 'Budi', phone: '6281234567890' },
    additionalTutors: [],
    programs: [{ program: 'SEMPOA' }],
    enrollments: [
      {
        studentId: 'st1',
        student: {
          name: 'Siswa 1',
          parent: { name: 'Ayah 1', phone: '6289999999999' },
        },
      },
    ],
  }
}

describe('GET /api/cron/timetable-generate - auto-broadcast toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.class.findMany as jest.Mock).mockResolvedValue([makeClass('c1')])
    ;(prisma.schedule.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.schedule.create as jest.Mock).mockResolvedValue({
      id: 's1', date: new Date(), participants: [
        { student: { name: 'Siswa 1', parent: { name: 'Ayah 1', phone: '6289999999999' } } }
      ],
    })
  })

  it('sends WA when AUTO_TIMETABLE_BROADCAST is true', async () => {
    ;(prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue({
      key: 'AUTO_TIMETABLE_BROADCAST', value: 'true',
    })

    const req = new Request(cronUrl)
    await GET(req as any)

    // Allow fire-and-forget to run
    await new Promise(r => setTimeout(r, 50))
    expect(waha.sendWhatsApp).toHaveBeenCalled()
  })

  it('skips WA when AUTO_TIMETABLE_BROADCAST is false', async () => {
    ;(prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue({
      key: 'AUTO_TIMETABLE_BROADCAST', value: 'false',
    })

    const req = new Request(cronUrl)
    await GET(req as any)

    await new Promise(r => setTimeout(r, 50))
    expect(waha.sendWhatsApp).not.toHaveBeenCalled()
  })

  it('sends WA when AUTO_TIMETABLE_BROADCAST setting is absent (default true)', async () => {
    ;(prisma.systemSetting.findFirst as jest.Mock).mockResolvedValue(null)

    const req = new Request(cronUrl)
    await GET(req as any)

    await new Promise(r => setTimeout(r, 50))
    expect(waha.sendWhatsApp).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/cron/timetable-auto-broadcast-toggle.test.ts --no-coverage
```

Expected: FAIL — `prisma.systemSetting` is not mocked / cron doesn't check the setting

- [ ] **Step 3: Update cron to check setting before broadcasting**

In `app/api/cron/timetable-generate/route.ts`, find the section after secret auth check and before the main try block (around line 53). Add the setting lookup and a flag.

Add this **inside the try block, right after `createdCount` and `generated` declarations** (around line 90):

```typescript
// Check auto-broadcast setting (default: enabled)
const broadcastSetting = await prisma.systemSetting.findFirst({
  where: { key: 'AUTO_TIMETABLE_BROADCAST' },
})
const autoBroadcastEnabled = broadcastSetting?.value !== 'false'

if (!autoBroadcastEnabled) {
  console.log('[Cron Timetable Scheduler] Auto-broadcast disabled by admin. Schedules will be created but WA will not be sent.')
}
```

Then find the `Promise.resolve().then(async () => {` block inside the for loop (around line 156). Wrap it with the flag check:

Change:
```typescript
Promise.resolve().then(async () => {
  // ... WA broadcast code
}).catch(err => {
  console.error('[Cron Timetable Auto-Broadcast] error:', err)
})
```

To:
```typescript
if (autoBroadcastEnabled) {
  Promise.resolve().then(async () => {
    // ... WA broadcast code (unchanged)
  }).catch(err => {
    console.error('[Cron Timetable Auto-Broadcast] error:', err)
  })
}
```

Also update the return message to mention when broadcast was skipped:

```typescript
return NextResponse.json({
  success: true,
  message: `Auto-Scheduler: Berhasil membuat dan merilis ${createdCount} jadwal untuk minggu depan (mulai ${nextMondayStr})!${
    !autoBroadcastEnabled ? ' ⚠️ Auto-broadcast dimatikan — WA tidak dikirim.' : ''
  }`,
  count: createdCount,
  autoBroadcastEnabled,
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/cron/timetable-auto-broadcast-toggle.test.ts --no-coverage
```

Expected: PASS (3/3)

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage 2>&1 | tail -10
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/timetable-generate/route.ts __tests__/api/cron/timetable-auto-broadcast-toggle.test.ts
git commit -m "feat: cron skips WA broadcast when AUTO_TIMETABLE_BROADCAST is disabled"
```

---

## Self-Review

| Requirement | Task |
|-------------|------|
| Superadmin bisa toggle auto-broadcast | Task 3 (UI) + Task 2 (API) |
| Default ON (tidak breaking cron existing) | Task 4 (default true when absent) |
| Jadwal tetap dibuat meski broadcast OFF | Task 4 (schedule.create unchanged) |
| Log saat broadcast di-skip | Task 4 |
| Test coverage | Tasks 2 + 4 |
| Schema migration | Task 1 |

No placeholders. Types consistent. `prisma.systemSetting` used in both API and cron after migration adds the model. `Bell`/`BellOff` icons already available in lucide-react.

**Note on cron timezone bug:** The cron route (`timetable-generate/route.ts`) still uses local-time `setDate`/`setHours` (not UTC like the fixed generate route). This is out of scope for this plan but worth a follow-up fix.
