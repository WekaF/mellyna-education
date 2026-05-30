# Report Notifications & Modern Invoice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a tutor saves a learning report, the parent receives an immediate WhatsApp notification; admin gets a daily digest and parents get a weekly digest. After Midtrans payment, the parent automatically receives a modern-designed PAID receipt via WhatsApp.

**Architecture:**
- Report notification: fire-and-forget WA send triggered inside `POST /api/reports` after upsert; `parentNotifiedAt` field prevents duplicate sends.
- Digest cron: new `/api/cron/report-digest` endpoint (same auth pattern as billing-reminders) with `?type=daily|weekly`.
- Invoice PDF: full redesign of `lib/invoice-pdf.ts` using teal palette, left accent bar, and receipt-style layout; auto-sent from the Midtrans webhook `sendPaidReceipt()` helper.

**Tech Stack:** Next.js 15 App Router, Prisma (PostgreSQL), WAHA WhatsApp API, pdfkit, Midtrans Snap

---

## Files

### New
| File | Purpose |
|------|---------|
| `lib/report-notify.ts` | WA notification helpers: per-report message, weekly digest builder, admin daily digest builder |
| `app/api/cron/report-digest/route.ts` | Cron endpoint: `?type=daily` → admin digest, `?type=weekly` → parent digests |
| `app/api/admin/reports/digest/route.ts` | Admin REST API: view aggregated report digest by date / type |

### Modified
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `parentNotifiedAt DateTime?` to `LearningReport` |
| `app/api/reports/route.ts` | Trigger WA after upsert (fire-and-forget, skip if already notified) |
| `lib/invoice-pdf.ts` | Full redesign: teal palette, left accent bar, modern layout |
| `app/api/webhooks/midtrans/route.ts` | Auto-send PAID receipt after `settlement`/`capture` |

---

## Task 1: Prisma Schema — Add parentNotifiedAt

**Files:**
- Modify: `prisma/schema.prisma` (LearningReport model)

- [ ] **Step 1: Add field**

Locate the `LearningReport` model. Add `parentNotifiedAt DateTime?` after the `score` field:

```prisma
model LearningReport {
  id               String    @id @default(cuid())
  studentId        String
  scheduleId       String
  tutorId          String
  content          String
  score            Int?
  parentNotifiedAt DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  student  Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  schedule Schedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  tutor    User     @relation(fields: [tutorId], references: [id])
  media    Media[]

  @@unique([studentId, scheduleId])
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_parent_notified_at_to_learning_report
```

Expected output: `The following migration(s) have been created and applied from new schema changes: migrations/..._add_parent_notified_at_to_learning_report`

- [ ] **Step 3: Verify client regenerated**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add parentNotifiedAt to LearningReport"
```

---

## Task 2: lib/report-notify.ts — WA Message Builders

**Files:**
- Create: `lib/report-notify.ts`
- Create: `__tests__/lib/report-notify.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/report-notify.test.ts`:

```typescript
import {
  buildAdminDailyDigestMessage,
  buildParentWeeklyDigestMessage,
} from '@/lib/report-notify'

describe('buildAdminDailyDigestMessage', () => {
  it('includes report count and class grouping', () => {
    const date = new Date('2026-05-29T00:00:00Z')
    const reports = [
      { studentName: 'Andi', className: 'Sempoa A', tutorName: 'Tutor X', score: 85 },
      { studentName: 'Budi', className: 'Sempoa A', tutorName: 'Tutor X', score: null },
      { studentName: 'Cici', className: 'Bahasa B', tutorName: 'Tutor Y', score: 90 },
    ]
    const msg = buildAdminDailyDigestMessage(date, reports)
    expect(msg).toContain('3')
    expect(msg).toContain('Sempoa A')
    expect(msg).toContain('Bahasa B')
    expect(msg).toContain('Andi')
    expect(msg).toContain('85')
  })

  it('handles empty report list', () => {
    const msg = buildAdminDailyDigestMessage(new Date(), [])
    expect(msg).toContain('0')
  })
})

describe('buildParentWeeklyDigestMessage', () => {
  it('includes parent name, student name, and score', () => {
    const start = new Date('2026-05-25T00:00:00Z')
    const end = new Date('2026-05-31T00:00:00Z')
    const reports = [
      {
        studentName: 'Andi',
        className: 'Sempoa A',
        score: 85,
        content: 'Sudah bisa penjumlahan 3 digit.',
        tutorName: 'Tutor X',
      },
    ]
    const msg = buildParentWeeklyDigestMessage('Bunda Sari', start, end, reports)
    expect(msg).toContain('Bunda Sari')
    expect(msg).toContain('Andi')
    expect(msg).toContain('85')
    expect(msg).toContain('Sempoa A')
  })

  it('truncates long content to 120 chars', () => {
    const longContent = 'A'.repeat(200)
    const msg = buildParentWeeklyDigestMessage(
      'Ortu',
      new Date(),
      new Date(),
      [{ studentName: 'S', className: 'C', score: null, content: longContent, tutorName: 'T' }]
    )
    expect(msg).toContain('…')
    expect(msg).not.toContain('A'.repeat(121))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/report-notify.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/report-notify'`

- [ ] **Step 3: Create lib/report-notify.ts**

```typescript
import { sendWhatsApp } from '@/lib/waha'

export interface ParentReportData {
  parentPhone: string
  parentName: string
  studentName: string
  className: string
  scheduleDate: Date
  topic: string | null
  score: number | null
  content: string
}

const fmtDateLong = (d: Date) =>
  new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)

const fmtDateShort = (d: Date) =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)

export async function notifyParentNewReport(data: ParentReportData): Promise<boolean> {
  const lines = [
    `Assalamualaikum Bunda/Ayah *${data.parentName}*,`,
    ``,
    `Laporan belajar *${data.studentName}* telah dibuat oleh tutor.`,
    ``,
    `📚 Kelas: ${data.className}`,
    `📅 Tanggal: ${fmtDateLong(data.scheduleDate)}`,
  ]
  if (data.topic) lines.push(`📖 Materi: ${data.topic}`)
  if (data.score !== null) lines.push(`⭐ Nilai: ${data.score}/100`)
  lines.push(``, `💬 *Catatan Tutor:*`, data.content, ``, `Terima kasih,`, `Mellyna Education`)
  return sendWhatsApp(data.parentPhone, lines.join('\n'))
}

export interface DigestReportItem {
  studentName: string
  className: string
  score: number | null
  content: string
  tutorName: string
}

export function buildParentWeeklyDigestMessage(
  parentName: string,
  weekStart: Date,
  weekEnd: Date,
  reports: DigestReportItem[]
): string {
  const lines = [
    `Halo Bunda/Ayah *${parentName}*,`,
    ``,
    `Berikut ringkasan laporan belajar minggu ${fmtDateShort(weekStart)} – ${fmtDateShort(weekEnd)}:`,
    ``,
  ]
  for (const r of reports) {
    lines.push(`👤 *${r.studentName}* — ${r.className}`)
    if (r.score !== null) lines.push(`   ⭐ Nilai: ${r.score}/100`)
    const preview = r.content.length > 120 ? r.content.slice(0, 120) + '…' : r.content
    lines.push(`   📝 ${preview}`, ``)
  }
  lines.push(`Pantau perkembangan lengkap di portal Mellyna Education.`)
  lines.push(`Terima kasih,\nMellyna Education`)
  return lines.join('\n')
}

export interface AdminDigestItem {
  studentName: string
  className: string
  tutorName: string
  score: number | null
}

export function buildAdminDailyDigestMessage(date: Date, reports: AdminDigestItem[]): string {
  const lines = [
    `📊 *Ringkasan Laporan Harian*`,
    `Tanggal: ${fmtDateLong(date)}`,
    `Total laporan: *${reports.length}*`,
    ``,
  ]
  const byClass: Record<string, AdminDigestItem[]> = {}
  for (const r of reports) {
    if (!byClass[r.className]) byClass[r.className] = []
    byClass[r.className].push(r)
  }
  for (const [cn, reps] of Object.entries(byClass)) {
    lines.push(`📚 *${cn}* (${reps.length} siswa)`)
    for (const r of reps) {
      const s = r.score !== null ? ` | Nilai: ${r.score}` : ''
      lines.push(`  • ${r.studentName}${s}`)
    }
    lines.push(``)
  }
  lines.push(`— Mellyna Education`)
  return lines.join('\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/report-notify.test.ts
```

Expected: PASS (3 test suites, all green)

- [ ] **Step 5: Commit**

```bash
git add lib/report-notify.ts __tests__/lib/report-notify.test.ts
git commit -m "feat: add report WA notification and digest message builders"
```

---

## Task 3: app/api/reports/route.ts — Trigger WA on Save

**Files:**
- Modify: `app/api/reports/route.ts`

- [ ] **Step 1: Replace the POST handler**

Full replacement of `app/api/reports/route.ts` (GET handler is unchanged; only the POST handler and a new helper are added):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notifyParentNewReport } from '@/lib/report-notify'

const upsertReportSchema = z.object({
  studentId: z.string().min(1),
  scheduleId: z.string().min(1),
  content: z.string().min(1),
  score: z.number().int().min(0).max(100).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId')
  const scheduleId = searchParams.get('scheduleId')

  let where: Record<string, unknown> = {}

  if (role === 'PARENT') {
    const children = await prisma.student.findMany({
      where: { parentId: userId },
      select: { id: true },
    })
    const childIds = children.map((c) => c.id)
    where = { studentId: { in: childIds } }
    if (studentId && childIds.includes(studentId)) where = { ...where, studentId }
  } else if (role === 'TUTOR') {
    where = { tutorId: userId }
    if (studentId) where = { ...where, studentId }
  } else if (role === 'SUPER_ADMIN') {
    if (studentId) where = { studentId }
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (scheduleId) where = { ...where, scheduleId }

  const reports = await prisma.learningReport.findMany({
    where,
    include: {
      student: { select: { id: true, name: true, grade: true } },
      tutor: { select: { id: true, name: true } },
      schedule: {
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          topic: true,
          location: true,
          class: { select: { name: true, programs: { select: { program: true } } } },
        },
      },
      media: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(reports)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id

  if (role !== 'SUPER_ADMIN' && role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = upsertReportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Check if this report already exists and was already notified
  const existing = await prisma.learningReport.findUnique({
    where: {
      studentId_scheduleId: {
        studentId: parsed.data.studentId,
        scheduleId: parsed.data.scheduleId,
      },
    },
    select: { id: true, parentNotifiedAt: true },
  })

  const report = await prisma.learningReport.upsert({
    where: {
      studentId_scheduleId: {
        studentId: parsed.data.studentId,
        scheduleId: parsed.data.scheduleId,
      },
    },
    update: { content: parsed.data.content, score: parsed.data.score },
    create: { ...parsed.data, tutorId: userId },
  })

  // Notify parent only on first save (not on edits that were already notified)
  if (!existing?.parentNotifiedAt) {
    void sendParentNotification(report.id)
  }

  return NextResponse.json(report, { status: 201 })
}

async function sendParentNotification(reportId: string): Promise<void> {
  try {
    const full = await prisma.learningReport.findUnique({
      where: { id: reportId },
      include: {
        student: {
          include: { parent: { select: { name: true, phone: true } } },
        },
        schedule: {
          include: { class: { select: { name: true } } },
        },
      },
    })

    if (!full?.student.parent?.phone) return

    const sent = await notifyParentNewReport({
      parentPhone: full.student.parent.phone,
      parentName: full.student.parent.name,
      studentName: full.student.name,
      className: full.schedule.class.name,
      scheduleDate: full.schedule.date,
      topic: full.schedule.topic,
      score: full.score,
      content: full.content,
    })

    if (sent) {
      await prisma.learningReport.update({
        where: { id: reportId },
        data: { parentNotifiedAt: new Date() },
      })
    }
  } catch (e) {
    console.error('[Report Notify] Failed to notify parent:', e)
  }
}
```

- [ ] **Step 2: Manual smoke test**

Start dev server, navigate to `/tutor/reports/[scheduleId]` for a schedule with students whose parent has a phone number set. Save a report. Check server console for `[WAHA]` log lines.

```bash
npm run dev
```

- [ ] **Step 3: Verify parentNotifiedAt is set in DB**

```bash
npx prisma studio
```

Open `LearningReport` table — the just-saved row should have `parentNotifiedAt` populated.

- [ ] **Step 4: Commit**

```bash
git add app/api/reports/route.ts
git commit -m "feat: trigger parent WA notification when tutor saves report"
```

---

## Task 4: app/api/cron/report-digest/route.ts — Daily & Weekly Digest Cron

**Files:**
- Create: `app/api/cron/report-digest/route.ts`
- Create: `__tests__/api/cron/report-digest.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/cron/report-digest.test.ts`:

```typescript
import { GET } from '@/app/api/cron/report-digest/route'
import { NextRequest } from 'next/server'

describe('GET /api/cron/report-digest', () => {
  it('returns 401 without valid secret', async () => {
    process.env.N8N_WEBHOOK_SECRET = 'test-secret'
    const req = new NextRequest(
      'http://localhost/api/cron/report-digest?type=daily&secret=wrong'
    )
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for unknown type', async () => {
    process.env.N8N_WEBHOOK_SECRET = 'test-secret'
    const req = new NextRequest(
      'http://localhost/api/cron/report-digest?type=monthly&secret=test-secret'
    )
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/cron/report-digest.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/cron/report-digest/route'`

- [ ] **Step 3: Create route file**

Create `app/api/cron/report-digest/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendWhatsApp, sleep, randomDelay } from '@/lib/waha'
import {
  buildAdminDailyDigestMessage,
  buildParentWeeklyDigestMessage,
} from '@/lib/report-notify'

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}

async function handleCron(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') ?? req.headers.get('x-cron-secret')
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET ?? 'change-this-to-random-secret'

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized: Invalid cron secret.' }, { status: 401 })
  }

  const type = searchParams.get('type') ?? 'daily'

  if (type === 'daily') return runDailyAdminDigest()
  if (type === 'weekly') return runWeeklyParentDigest()

  return NextResponse.json({ error: 'Invalid type. Use daily or weekly.' }, { status: 400 })
}

async function runDailyAdminDigest(): Promise<NextResponse> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const yesterdayEnd = new Date(yesterday)
  yesterdayEnd.setHours(23, 59, 59, 999)

  const reports = await prisma.learningReport.findMany({
    where: { createdAt: { gte: yesterday, lte: yesterdayEnd } },
    include: {
      student: { select: { name: true } },
      tutor: { select: { name: true } },
      schedule: { include: { class: { select: { name: true } } } },
    },
  })

  if (reports.length === 0) {
    return NextResponse.json({ success: true, message: 'Tidak ada laporan kemarin.', sent: 0 })
  }

  const admins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: { phone: true, name: true },
  })

  const message = buildAdminDailyDigestMessage(
    yesterday,
    reports.map((r) => ({
      studentName: r.student.name,
      className: r.schedule.class.name,
      tutorName: r.tutor.name,
      score: r.score,
    }))
  )

  let sent = 0
  for (const admin of admins) {
    if (!admin.phone) continue
    const ok = await sendWhatsApp(admin.phone, message)
    if (ok) sent++
    await sleep(randomDelay(2000, 4000))
  }

  return NextResponse.json({ success: true, reportCount: reports.length, adminsSent: sent })
}

async function runWeeklyParentDigest(): Promise<NextResponse> {
  const now = new Date()
  const dow = now.getDay()
  const daysToLastMon = dow === 0 ? 6 : dow - 1

  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - daysToLastMon - 7)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const parents = await prisma.user.findMany({
    where: {
      role: 'PARENT',
      phone: { not: null },
      children: {
        some: {
          reports: {
            some: { createdAt: { gte: weekStart, lte: weekEnd } },
          },
        },
      },
    },
    select: {
      name: true,
      phone: true,
      children: {
        select: {
          name: true,
          reports: {
            where: { createdAt: { gte: weekStart, lte: weekEnd } },
            include: {
              schedule: { include: { class: { select: { name: true } } } },
              tutor: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  let sent = 0
  for (const parent of parents) {
    if (!parent.phone) continue

    const digestItems = parent.children.flatMap((child) =>
      child.reports.map((r) => ({
        studentName: child.name,
        className: r.schedule.class.name,
        score: r.score,
        content: r.content,
        tutorName: r.tutor.name,
      }))
    )

    if (digestItems.length === 0) continue

    const message = buildParentWeeklyDigestMessage(parent.name, weekStart, weekEnd, digestItems)
    const ok = await sendWhatsApp(parent.phone, message)
    if (ok) sent++
    await sleep(randomDelay(3000, 7000))
  }

  return NextResponse.json({ success: true, weekStart, weekEnd, parentsSent: sent })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/cron/report-digest.test.ts
```

Expected: PASS

- [ ] **Step 5: Register cron in N8N**

In N8N, add two Cron trigger → HTTP Request nodes:

| Schedule | URL | Notes |
|----------|-----|-------|
| Daily at 07:00 WIB | `POST /api/cron/report-digest?type=daily&secret=<N8N_WEBHOOK_SECRET>` | Sends admin digest of previous day |
| Monday at 08:00 WIB | `POST /api/cron/report-digest?type=weekly&secret=<N8N_WEBHOOK_SECRET>` | Sends parents previous week summary |

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/report-digest/route.ts __tests__/api/cron/report-digest.test.ts
git commit -m "feat: add daily admin and weekly parent report digest cron endpoint"
```

---

## Task 5: app/api/admin/reports/digest/route.ts — Admin Digest View API

**Files:**
- Create: `app/api/admin/reports/digest/route.ts`
- Create: `__tests__/api/admin/reports/digest.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/admin/reports/digest.test.ts`:

```typescript
import { GET } from '@/app/api/admin/reports/digest/route'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
}))

describe('GET /api/admin/reports/digest', () => {
  it('returns 401 for unauthenticated requests', async () => {
    const req = new NextRequest('http://localhost/api/admin/reports/digest')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/admin/reports/digest.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/admin/reports/digest/route'`

- [ ] **Step 3: Create route file**

Create `app/api/admin/reports/digest/route.ts`:

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
  const type = searchParams.get('type') ?? 'daily'
  const dateStr = searchParams.get('date')
  const date = dateStr ? new Date(dateStr) : new Date()

  let start: Date, end: Date

  if (type === 'daily') {
    start = new Date(date)
    start.setHours(0, 0, 0, 0)
    end = new Date(date)
    end.setHours(23, 59, 59, 999)
  } else {
    const dow = date.getDay()
    const daysToMon = dow === 0 ? 6 : dow - 1
    start = new Date(date)
    start.setDate(date.getDate() - daysToMon)
    start.setHours(0, 0, 0, 0)
    end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
  }

  const reports = await prisma.learningReport.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: {
      student: {
        select: {
          name: true,
          grade: true,
          parent: { select: { name: true } },
        },
      },
      tutor: { select: { name: true } },
      schedule: {
        include: { class: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const byClass: Record<string, typeof reports> = {}
  for (const r of reports) {
    const cn = r.schedule.class.name
    if (!byClass[cn]) byClass[cn] = []
    byClass[cn].push(r)
  }

  const summary = Object.entries(byClass).map(([className, reps]) => {
    const scored = reps.filter((r) => r.score !== null)
    return {
      className,
      count: reps.length,
      avgScore:
        scored.length > 0
          ? Math.round(scored.reduce((s, r) => s + r.score!, 0) / scored.length)
          : null,
      reports: reps,
    }
  })

  return NextResponse.json({
    period: { type, start, end },
    totalReports: reports.length,
    byClass: summary,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/admin/reports/digest.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/reports/digest/route.ts __tests__/api/admin/reports/digest.test.ts
git commit -m "feat: add admin report digest REST endpoint"
```

---

## Task 6: lib/invoice-pdf.ts — Modern Invoice Redesign

Design: teal palette (`#0d9488`), 8px left accent bar, header band, status stripe, two-column meta, clean items table, teal total box, teal-tint footer.

**Files:**
- Modify: `lib/invoice-pdf.ts`
- Create: `__tests__/lib/invoice-pdf.test.ts`

- [ ] **Step 1: Write the test (basic contract: Buffer + %PDF header)**

Create `__tests__/lib/invoice-pdf.test.ts`:

```typescript
import { generateInvoicePdf, InvoiceData } from '@/lib/invoice-pdf'

const mockInvoice: InvoiceData = {
  id: 'cltest123456789',
  description: 'Biaya Kursus Sempoa Bulan Juni 2026',
  amount: 350000,
  dueDate: new Date('2026-06-30'),
  status: 'PAID',
  paidAt: new Date('2026-06-10'),
  createdAt: new Date('2026-06-01'),
  student: {
    name: 'Ahmad Fauzi',
    grade: 'Kelas 3 SD',
    parent: {
      name: 'Bapak Fauzi',
      phone: '081234567890',
      email: 'fauzi@example.com',
    },
  },
}

describe('generateInvoicePdf', () => {
  it('returns a non-empty Buffer', async () => {
    const buf = await generateInvoicePdf(mockInvoice)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(1000)
  })

  it('PDF starts with %PDF magic bytes', async () => {
    const buf = await generateInvoicePdf(mockInvoice)
    expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF')
  })

  it('works for all status values', async () => {
    const statuses: InvoiceData['status'][] = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']
    for (const status of statuses) {
      const buf = await generateInvoicePdf({ ...mockInvoice, status, paidAt: null })
      expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF')
    }
  })
})
```

- [ ] **Step 2: Run test to see current state**

```bash
npx jest __tests__/lib/invoice-pdf.test.ts
```

Expected: PASS (existing implementation already satisfies these checks; redesign must keep them passing)

- [ ] **Step 3: Replace lib/invoice-pdf.ts with modern design**

```typescript
import PDFDocument from 'pdfkit'

export interface InvoiceData {
  id: string
  description: string
  amount: number
  dueDate: Date
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  paidAt: Date | null
  createdAt: Date
  student: {
    name: string
    grade: string | null
    parent: {
      name: string
      phone: string | null
      email: string
    }
  }
}

// ── Design tokens ──────────────────────────────────────────────
const C = {
  teal:      '#0d9488',
  tealDark:  '#134e4a',
  tealLight: '#f0fdfa',
  tealMid:   '#99f6e4',
  navy:      '#0f172a',
  slate:     '#1e293b',
  gray:      '#64748b',
  light:     '#f8fafc',
  border:    '#e2e8f0',
  white:     '#ffffff',
} as const

const STATUS_LABELS: Record<string, string> = {
  PENDING:   'BELUM LUNAS',
  PAID:      'LUNAS',
  OVERDUE:   'TERLAMBAT',
  CANCELLED: 'DIBATALKAN',
}

const STATUS_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  PAID:      { bg: '#d1fae5', text: '#065f46', bar: '#10b981' },
  PENDING:   { bg: '#fef3c7', text: '#92400e', bar: '#f59e0b' },
  OVERDUE:   { bg: '#fee2e2', text: '#991b1b', bar: '#ef4444' },
  CANCELLED: { bg: '#f1f5f9', text: '#475569', bar: '#94a3b8' },
}

function formatRp(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n)
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function invoiceNumber(invoice: InvoiceData): string {
  const y = invoice.createdAt.getFullYear()
  const m = String(invoice.createdAt.getMonth() + 1).padStart(2, '0')
  const suffix = invoice.id.slice(-6).toUpperCase()
  return `INV-${y}${m}-${suffix}`
}

export function generateInvoicePdf(invoice: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = doc.page.width   // 595.28
    const H = doc.page.height  // 841.89
    const ACC = 8              // left accent bar width
    const P = 38               // left content padding
    const R = W - 40           // right edge
    const sc = STATUS_COLORS[invoice.status] ?? STATUS_COLORS['PENDING']
    const invNo = invoiceNumber(invoice)

    // ── White background ─────────────────────────────────────
    doc.rect(0, 0, W, H).fill(C.white)

    // ── Left accent bar (full height) ─────────────────────────
    doc.rect(0, 0, ACC, H).fill(C.teal)

    // ── Teal header band ──────────────────────────────────────
    doc.rect(ACC, 0, W - ACC, 88).fill(C.teal)

    // Company name (white on teal)
    doc
      .fill(C.white)
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('MELLYNA EDUCATION', P, 22)
    doc
      .fill(C.tealMid)
      .fontSize(9)
      .font('Helvetica')
      .text('Bimbingan Belajar & Kursus Sempoa  •  Yogyakarta', P, 52)

    // INVOICE label (right side of header)
    doc
      .fill(C.white)
      .fontSize(30)
      .font('Helvetica-Bold')
      .text('INVOICE', 0, 18, { width: R, align: 'right' })
    doc
      .fill(C.tealMid)
      .fontSize(9)
      .font('Helvetica')
      .text(`No. ${invNo}`, 0, 57, { width: R, align: 'right' })

    // ── Status colour stripe (8px, just below header) ─────────
    doc.rect(ACC, 88, W - ACC, 8).fill(sc.bar)

    // ── Two-column meta section (y = 110 to ~205) ─────────────
    const metaY = 108

    // Left — Bill To
    doc
      .fill(C.gray)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('TAGIHAN KEPADA', P, metaY)
    doc
      .fill(C.navy)
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(invoice.student.parent.name, P, metaY + 14)

    doc.fill(C.gray).fontSize(9).font('Helvetica')
    let infoY = metaY + 32
    if (invoice.student.parent.phone) {
      doc.text(`HP: ${invoice.student.parent.phone}`, P, infoY)
      infoY += 14
    }
    doc.text(invoice.student.parent.email, P, infoY)
    infoY += 14
    doc.text(
      `Siswa: ${invoice.student.name}${invoice.student.grade ? ` (${invoice.student.grade})` : ''}`,
      P,
      infoY
    )

    // Right — Invoice detail box
    const boxX = W / 2 + 20
    const boxW = R - boxX
    doc.rect(boxX, metaY, boxW, 90).fill(C.light)

    doc
      .fill(C.gray)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('DETAIL INVOICE', boxX + 12, metaY + 12)

    const detailRows: [string, string][] = [
      ['No. Invoice', invNo],
      ['Tanggal', formatDate(invoice.createdAt)],
      ['Jatuh Tempo', formatDate(invoice.dueDate)],
    ]
    if (invoice.paidAt) detailRows.push(['Tgl. Bayar', formatDate(invoice.paidAt)])

    detailRows.forEach(([label, value], i) => {
      const ry = metaY + 28 + i * 16
      doc.fill(C.gray).fontSize(8).font('Helvetica').text(label, boxX + 12, ry)
      doc
        .fill(C.slate)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(value, boxX + 12, ry, { width: boxW - 24, align: 'right' })
    })

    // ── Status badge ──────────────────────────────────────────
    const badgeY = 214
    doc.rect(P, badgeY, 160, 30).fill(sc.bg)
    doc
      .fill(sc.text)
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(STATUS_LABELS[invoice.status] ?? invoice.status, P, badgeY + 9, {
        width: 160,
        align: 'center',
      })

    // ── Items table ───────────────────────────────────────────
    const tableY = 264

    // Table header
    doc.rect(P, tableY, R - P, 26).fill(C.slate)
    doc.fill(C.white).fontSize(9).font('Helvetica-Bold')
    doc.text('KETERANGAN', P + 12, tableY + 9)
    doc.text('NOMINAL', 0, tableY + 9, { width: R - 8, align: 'right' })

    // Data row
    doc.rect(P, tableY + 26, R - P, 40).fill(C.light)
    doc
      .fill(C.navy)
      .fontSize(9)
      .font('Helvetica')
      .text(invoice.description, P + 12, tableY + 37, { width: R - P - 130 })
    doc
      .fill(C.slate)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(formatRp(invoice.amount), 0, tableY + 37, { width: R - 8, align: 'right' })

    // Table bottom border
    doc
      .moveTo(P, tableY + 66)
      .lineTo(R, tableY + 66)
      .strokeColor(C.border)
      .lineWidth(1)
      .stroke()

    // ── Total box ─────────────────────────────────────────────
    const totalY = tableY + 80
    const totalBoxW = 230
    const totalBoxX = R - totalBoxW
    doc.rect(totalBoxX, totalY, totalBoxW, 46).fill(C.tealLight)
    doc
      .fill(C.tealDark)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('TOTAL PEMBAYARAN', totalBoxX + 14, totalY + 8)
    doc
      .fill(C.teal)
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(formatRp(invoice.amount), totalBoxX, totalY + 22, {
        width: totalBoxW - 14,
        align: 'right',
      })

    // ── Payment note ──────────────────────────────────────────
    const noteY = totalY + 62
    doc
      .moveTo(P, noteY)
      .lineTo(R, noteY)
      .strokeColor(C.border)
      .lineWidth(0.5)
      .stroke()

    doc
      .fill(C.gray)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('CARA PEMBAYARAN', P, noteY + 14)
    doc
      .fill(C.gray)
      .fontSize(8)
      .font('Helvetica')
      .text(
        'Pembayaran dapat dilakukan melalui portal Mellyna Education (Midtrans) atau transfer bank. ' +
        'Hubungi admin untuk konfirmasi atau pertanyaan lebih lanjut.',
        P,
        noteY + 28,
        { width: R - P }
      )

    // ── Footer ────────────────────────────────────────────────
    const footerY = H - 52
    doc.rect(ACC, footerY, W - ACC, 52).fill(C.tealLight)
    doc.rect(0, footerY, ACC, 52).fill(C.teal)
    doc
      .fill(C.teal)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('MELLYNA EDUCATION', P, footerY + 12)
    doc
      .fill(C.gray)
      .fontSize(7.5)
      .font('Helvetica')
      .text(
        `info@mellynaeducation.id  •  Yogyakarta, Indonesia  •  Diterbitkan otomatis ${formatDate(new Date())}`,
        P,
        footerY + 30,
        { width: R - P }
      )

    doc.end()
  })
}
```

- [ ] **Step 4: Run test to verify it still passes**

```bash
npx jest __tests__/lib/invoice-pdf.test.ts
```

Expected: PASS

- [ ] **Step 5: Generate a visual preview**

```bash
node -e "
const { generateInvoicePdf } = require('./lib/invoice-pdf')
generateInvoicePdf({
  id: 'cltest123456789a',
  description: 'Biaya Kursus Sempoa Bulan Juni 2026',
  amount: 350000,
  dueDate: new Date('2026-06-30'),
  status: 'PAID',
  paidAt: new Date('2026-06-10'),
  createdAt: new Date('2026-06-01'),
  student: {
    name: 'Ahmad Fauzi',
    grade: 'Kelas 3 SD',
    parent: { name: 'Bapak Fauzi', phone: '081234567890', email: 'fauzi@example.com' }
  }
}).then(buf => {
  require('fs').writeFileSync('invoice-preview.pdf', buf)
  console.log('Written to invoice-preview.pdf')
})
"
```

Open `invoice-preview.pdf` to verify: teal header band, left accent bar, status stripe, two-column meta box, clean table with dark header, teal total box, teal footer.

- [ ] **Step 6: Commit**

```bash
git add lib/invoice-pdf.ts __tests__/lib/invoice-pdf.test.ts
git commit -m "feat: redesign invoice PDF with modern teal palette and receipt layout"
```

---

## Task 7: app/api/webhooks/midtrans/route.ts — Auto-Send PAID Receipt

After Midtrans `settlement`/`capture`, auto-generate the redesigned PDF and send it to the parent via WhatsApp.

**Files:**
- Modify: `app/api/webhooks/midtrans/route.ts`
- Create: `__tests__/api/webhooks/midtrans.test.ts`

- [ ] **Step 1: Write the test**

Create `__tests__/api/webhooks/midtrans.test.ts`:

```typescript
import { POST } from '@/app/api/webhooks/midtrans/route'
import { NextRequest } from 'next/server'

describe('POST /api/webhooks/midtrans', () => {
  it('rejects invalid signature with 403', async () => {
    process.env.MIDTRANS_SERVER_KEY = 'test-server-key'
    const req = new NextRequest('http://localhost/api/webhooks/midtrans', {
      method: 'POST',
      body: JSON.stringify({
        order_id: 'inv_test_001',
        status_code: '200',
        gross_amount: '350000.00',
        signature_key: 'invalid_bad_signature',
        transaction_status: 'settlement',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run test to verify current behavior**

```bash
npx jest __tests__/api/webhooks/midtrans.test.ts
```

Expected: PASS (existing code already rejects invalid signatures with 403)

- [ ] **Step 3: Add sendPaidReceipt to the webhook handler**

Replace `app/api/webhooks/midtrans/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { sendWhatsAppFile } from '@/lib/waha'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { order_id, status_code, gross_amount, signature_key, transaction_status } = body

    const serverKey = process.env.MIDTRANS_SERVER_KEY ?? ''
    const expectedSignature = createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest('hex')

    if (signature_key !== expectedSignature) {
      console.error('[Midtrans Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const invoice = await prisma.invoice.findFirst({
      where: { midtransId: order_id },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })

    if (!invoice) {
      console.error('[Midtrans Webhook] Invoice not found for order:', order_id)
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const paymentId = invoice.payments[0]?.id

    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      const paidAt = new Date()
      await prisma.$transaction([
        prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID', paidAt },
        }),
        ...(paymentId
          ? [
              prisma.payment.update({
                where: { id: paymentId },
                data: { status: 'SUCCESS', paidAt, midtransData: body },
              }),
            ]
          : []),
      ])

      // Auto-send PAID receipt via WhatsApp (fire and forget)
      void sendPaidReceipt(invoice.id, paidAt)
    } else if (['cancel', 'deny', 'expire'].includes(transaction_status)) {
      if (paymentId) {
        await prisma.payment.update({
          where: { id: paymentId },
          data: { status: 'FAILED', midtransData: body },
        })
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[Midtrans Webhook Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

async function sendPaidReceipt(invoiceId: string, paidAt: Date): Promise<void> {
  try {
    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        student: {
          select: {
            name: true,
            grade: true,
            parent: { select: { name: true, phone: true, email: true } },
          },
        },
      },
    })

    if (!inv?.student.parent?.phone) return

    const pdfBuffer = await generateInvoicePdf({
      id: inv.id,
      description: inv.description,
      amount: inv.amount,
      dueDate: inv.dueDate,
      status: 'PAID',
      paidAt,
      createdAt: inv.createdAt,
      student: inv.student,
    })

    const y = inv.createdAt.getFullYear()
    const mo = String(inv.createdAt.getMonth() + 1).padStart(2, '0')
    const invNo = `INV-${y}${mo}-${inv.id.slice(-6).toUpperCase()}`
    const filename = `KWITANSI-${invNo}.pdf`
    const base64 = pdfBuffer.toString('base64')

    const fmt = (n: number) =>
      new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(n)

    const fmtDate = (d: Date) =>
      new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(d)

    const caption =
      `Terima kasih *${inv.student.parent.name}*! 🎉\n\n` +
      `Pembayaran untuk *${inv.student.name}* telah *berhasil dikonfirmasi*.\n\n` +
      `📄 No. Invoice: ${invNo}\n` +
      `💰 Nominal: ${fmt(inv.amount)}\n` +
      `📅 Tgl. Bayar: ${fmtDate(paidAt)}\n\n` +
      `Kwitansi terlampir. Terima kasih telah mempercayakan pendidikan anak kepada Mellyna Education! 🎓`

    await sendWhatsAppFile(inv.student.parent.phone, base64, filename, 'application/pdf', caption)
    console.log(`[Midtrans] Receipt sent to ${inv.student.parent.phone} for ${invNo}`)
  } catch (e) {
    console.error('[Midtrans] Failed to send receipt:', e)
  }
}
```

- [ ] **Step 4: Run test to verify still passes**

```bash
npx jest __tests__/api/webhooks/midtrans.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/midtrans/route.ts __tests__/api/webhooks/midtrans.test.ts
git commit -m "feat: auto-send PAID receipt via WhatsApp after Midtrans payment"
```

---

## Self-Review

### Spec coverage
| Requirement | Task |
|-------------|------|
| Tutor submits report → parent gets WA immediately | Task 3 |
| Superadmin gets daily report digest | Task 4 (type=daily) |
| Parents get weekly report digest | Task 4 (type=weekly) |
| Modern/kekinian invoice design | Task 6 |
| Auto-send PAID receipt after payment | Task 7 |
| Admin can view report digest in app | Task 5 |

### Type consistency
- `InvoiceData` interface defined once in `lib/invoice-pdf.ts` (Task 6); used in `midtrans/route.ts` (Task 7) via import — same shape.
- `DigestReportItem` / `AdminDigestItem` defined in `lib/report-notify.ts` (Task 2); used in `app/api/cron/report-digest/route.ts` (Task 4) via import.
- `ParentReportData` defined in Task 2 and called in `sendParentNotification()` in Task 3.

### No placeholders
All code steps contain complete, compilable implementations. No TBD/TODO.
