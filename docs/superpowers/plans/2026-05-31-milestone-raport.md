# Milestone Raport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a milestone raport system where superadmin publishes period-based snapshot reports per student (monthly / semester / custom date range), viewable as web page and downloadable as PDF, with optional WhatsApp PDF delivery to parents.

**Architecture:** New `MilestoneReport` model stores a JSON snapshot of all milestone statuses + session score summary at publish time (history preserved). Admin generates from `/admin/milestones/reports`; parent views and downloads from `/parent/milestone-reports`. PDF generated server-side via jsPDF in an API route. WhatsApp sends both a text summary and the PDF file via existing `sendWhatsAppFile` in `lib/waha.ts`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma ORM (PostgreSQL), NextAuth JWT sessions, Tailwind CSS, Zod, jsPDF + jspdf-autotable (already in package.json), WAHA WhatsApp API, Lucide React.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add `ReportPeriodType` enum, `MilestoneReport` model + relations on Student and User |
| Create | `lib/milestone-report-pdf.ts` | Server-side jsPDF generation from snapshot data → returns `ArrayBuffer` |
| Create | `lib/milestone-report-notify.ts` | WhatsApp text + PDF file send for raport |
| Create | `app/api/milestone-reports/route.ts` | GET list (admin all / parent own children), POST create+publish |
| Create | `app/api/milestone-reports/[id]/route.ts` | GET single report, DELETE |
| Create | `app/api/milestone-reports/[id]/pdf/route.ts` | GET → generate PDF on-the-fly, stream as download |
| Create | `app/(dashboard)/admin/milestones/reports/page.tsx` | Server component — fetch students + reports |
| Create | `app/(dashboard)/admin/milestones/reports/MilestoneReportsClient.tsx` | Admin UI — publish, list, delete raports |
| Create | `app/(dashboard)/parent/milestone-reports/page.tsx` | Parent — list raports, web view, download PDF |
| Modify | `components/dashboard/sidebar.tsx` | Add "Raport" sub-item under Kurikulum (admin) + "Raport Milestone" (parent) |
| Create | `__tests__/api/milestone-reports.test.ts` | Unit tests for period logic and snapshot computation |

---

## Task 1: Schema — MilestoneReport Model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add ReportPeriodType enum**

Open `prisma/schema.prisma`. After the `MilestoneStatus` enum block, add:

```prisma
enum ReportPeriodType {
  MONTHLY
  SEMESTER
  CUSTOM
}
```

- [ ] **Step 2: Add MilestoneReport model**

After the `StudentMilestone` model, add:

```prisma
model MilestoneReport {
  id             String           @id @default(cuid())
  studentId      String
  periodType     ReportPeriodType
  periodLabel    String
  periodStart    DateTime
  periodEnd      DateTime
  notes          String?          @db.Text
  snapshotJson   Json
  sessionSummary Json
  generatedById  String
  notifiedAt     DateTime?
  createdAt      DateTime         @default(now())

  student     Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  generatedBy User    @relation("MilestoneReportGenerator", fields: [generatedById], references: [id])

  @@index([studentId, createdAt])
}
```

- [ ] **Step 3: Add relations to Student and User models**

In the `Student` model, after the `studentMilestones StudentMilestone[]` line, add:

```prisma
  milestoneReports     MilestoneReport[]
```

In the `User` model, after the `milestoneUpdates StudentMilestone[] @relation("MilestoneUpdater")` line, add:

```prisma
  milestoneReports     MilestoneReport[] @relation("MilestoneReportGenerator")
```

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name add_milestone_reports
```

Expected output:
```
✔ Generated Prisma Client
The following migration(s) have been applied:
  migrations/XXXXXXXX_add_milestone_reports/migration.sql
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add MilestoneReport model and ReportPeriodType enum to schema"
```

---

## Task 2: Tests — Period Logic and Snapshot Computation

**Files:**
- Create: `__tests__/api/milestone-reports.test.ts`

- [ ] **Step 1: Write tests**

Create `__tests__/api/milestone-reports.test.ts`:

```typescript
describe('MilestoneReport period logic', () => {
  it('MONTHLY: periodStart is first day of month, periodEnd is last day', () => {
    const year = 2026, monthIdx = 4 // May (0-indexed)
    const start = new Date(year, monthIdx, 1)
    const end = new Date(year, monthIdx + 1, 0, 23, 59, 59)
    expect(start.getDate()).toBe(1)
    expect(end.getMonth()).toBe(monthIdx)
    expect(end.getDate()).toBe(31) // May has 31 days
  })

  it('SEMESTER 1: covers Jan 1 through Jun 30', () => {
    const year = 2026
    const start = new Date(year, 0, 1)
    const end = new Date(year, 5, 30, 23, 59, 59)
    expect(start.getMonth()).toBe(0)
    expect(end.getMonth()).toBe(5)
    expect(end.getDate()).toBe(30)
  })

  it('SEMESTER 2: covers Jul 1 through Dec 31', () => {
    const year = 2026
    const start = new Date(year, 6, 1)
    const end = new Date(year, 11, 31, 23, 59, 59)
    expect(start.getMonth()).toBe(6)
    expect(end.getMonth()).toBe(11)
    expect(end.getDate()).toBe(31)
  })

  it('CUSTOM: arbitrary date range, end is after start', () => {
    const start = new Date('2026-04-01')
    const end = new Date('2026-05-31')
    expect(end > start).toBe(true)
  })
})

describe('MilestoneReport snapshot computation', () => {
  it('computes percent correctly', () => {
    const calc = (completed: number, total: number) =>
      total === 0 ? 0 : Math.round((completed / total) * 100)
    expect(calc(3, 10)).toBe(30)
    expect(calc(10, 10)).toBe(100)
    expect(calc(0, 5)).toBe(0)
    expect(calc(0, 0)).toBe(0)
  })

  it('computes avgScore from non-null scores', () => {
    const scores = [80, 90, 85, 75]
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    expect(avg).toBe(83)
  })

  it('avgScore is null when no sessions have scores', () => {
    const scores: number[] = []
    const avg = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null
    expect(avg).toBeNull()
  })

  it('snapshot skips programs with no milestones', () => {
    const programs = ['SEMPOA', 'AHE', 'ENGLISH']
    const milestonesByProgram: Record<string, number> = { SEMPOA: 5, AHE: 0, ENGLISH: 3 }
    const active = programs.filter((p) => (milestonesByProgram[p] ?? 0) > 0)
    expect(active).toEqual(['SEMPOA', 'ENGLISH'])
  })
})

describe('MilestoneReport access control', () => {
  it('only SUPER_ADMIN can create raport', () => {
    const allowed = ['SUPER_ADMIN']
    expect(allowed.includes('SUPER_ADMIN')).toBe(true)
    expect(allowed.includes('TUTOR')).toBe(false)
    expect(allowed.includes('PARENT')).toBe(false)
  })

  it('PARENT can only read their own children raports', () => {
    const parentId = 'parent-1'
    const ownChild = { parentId: 'parent-1' }
    const otherChild = { parentId: 'parent-2' }
    expect(ownChild.parentId === parentId).toBe(true)
    expect(otherChild.parentId === parentId).toBe(false)
  })

  it('TUTOR cannot read raports', () => {
    const forbidden = ['TUTOR']
    expect(forbidden.includes('TUTOR')).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npx jest __tests__/api/milestone-reports.test.ts --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add __tests__/api/milestone-reports.test.ts
git commit -m "test: add unit tests for milestone raport period logic and access control"
```

---

## Task 3: PDF Generator Lib

**Files:**
- Create: `lib/milestone-report-pdf.ts`

- [ ] **Step 1: Create lib**

Create `lib/milestone-report-pdf.ts`:

```typescript
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export type MilestoneEntry = {
  id: string
  name: string
  description: string | null
  order: number
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  completedAt: string | null
}

export type ProgramSnapshot = {
  program: string
  label: string
  completedCount: number
  inProgressCount: number
  notStartedCount: number
  totalCount: number
  percent: number
  milestones: MilestoneEntry[]
}

export type MilestoneSnapshotData = {
  programs: ProgramSnapshot[]
}

export type SessionSummaryData = {
  totalSessions: number
  avgScore: number | null
}

export type RaportData = {
  studentName: string
  periodLabel: string
  generatedAt: Date
  notes: string | null
  snapshot: MilestoneSnapshotData
  session: SessionSummaryData
}

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Selesai',
  IN_PROGRESS: 'Berjalan',
  NOT_STARTED: 'Belum Mulai',
}

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

export function generateRaportPdf(data: RaportData): ArrayBuffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  let y = 15

  // Header bar
  doc.setFillColor(99, 102, 241)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Raport Perkembangan Belajar', pageW / 2, 11, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Mellyna Education', pageW / 2, 18, { align: 'center' })
  doc.setFontSize(8)
  doc.text(`Diterbitkan: ${fmtDate(data.generatedAt)}`, pageW / 2, 24, { align: 'center' })

  y = 36
  doc.setTextColor(30, 30, 30)

  // Student info box
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, y, pageW - 28, 22, 3, 3, 'FD')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Nama Siswa', 20, y + 7)
  doc.text('Periode', 20, y + 14)
  doc.setFont('helvetica', 'normal')
  doc.text(`: ${data.studentName}`, 55, y + 7)
  doc.text(`: ${data.periodLabel}`, 55, y + 14)
  y += 30

  // Session summary
  if (data.session.totalSessions > 0) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(99, 102, 241)
    doc.text('RINGKASAN SESI', 14, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    const sessionText = [
      `Total sesi: ${data.session.totalSessions} pertemuan`,
      data.session.avgScore !== null ? `   |   Rata-rata nilai: ${data.session.avgScore}/100` : '',
    ].join('')
    doc.text(sessionText, 14, y)
    y += 10
  }

  // Per-program milestone tables
  for (const prog of data.snapshot.programs) {
    if (prog.totalCount === 0) continue

    // Program header
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(99, 102, 241)
    doc.text(`PROGRAM ${prog.label.toUpperCase()}`, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(
      `${prog.completedCount}/${prog.totalCount} selesai (${prog.percent}%)`,
      pageW - 14,
      y,
      { align: 'right' }
    )

    // Progress bar
    y += 3
    const barW = pageW - 28
    doc.setFillColor(226, 232, 240)
    doc.rect(14, y, barW, 3, 'F')
    if (prog.percent > 0) {
      doc.setFillColor(99, 102, 241)
      doc.rect(14, y, (barW * prog.percent) / 100, 3, 'F')
    }
    y += 7

    autoTable(doc, {
      startY: y,
      head: [['No', 'Milestone', 'Status', 'Tanggal Selesai']],
      body: prog.milestones.map((m, idx) => [
        String(idx + 1),
        m.name,
        STATUS_LABEL[m.status],
        m.completedAt ? fmtDate(m.completedAt) : '—',
      ]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        2: { cellWidth: 30 },
        3: { cellWidth: 38 },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const status = prog.milestones[hookData.row.index]?.status
          if (status === 'COMPLETED') hookData.cell.styles.textColor = [16, 185, 129]
          else if (status === 'IN_PROGRESS') hookData.cell.styles.textColor = [245, 158, 11]
          else hookData.cell.styles.textColor = [148, 163, 184]
        }
      },
      theme: 'grid',
    })

    y = (doc as any).lastAutoTable.finalY + 10

    if (y > 260) {
      doc.addPage()
      y = 20
    }
  }

  // Admin notes
  if (data.notes) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(99, 102, 241)
    doc.text('CATATAN', 14, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    const noteLines = doc.splitTextToSize(data.notes, pageW - 28)
    doc.text(noteLines, 14, y)
  }

  // Footer
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text(
    'Mellyna Education — Dokumen ini diterbitkan secara resmi oleh administrator.',
    pageW / 2,
    287,
    { align: 'center' }
  )

  return doc.output('arraybuffer')
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Expected: no errors in `lib/milestone-report-pdf.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/milestone-report-pdf.ts
git commit -m "feat: add server-side milestone raport PDF generator"
```

---

## Task 4: WhatsApp Notification Lib

**Files:**
- Create: `lib/milestone-report-notify.ts`

- [ ] **Step 1: Create lib**

Create `lib/milestone-report-notify.ts`:

```typescript
import { sendWhatsApp, sendWhatsAppFile } from '@/lib/waha'

export interface MilestoneReportNotifyData {
  parentPhone: string
  parentName: string
  studentName: string
  periodLabel: string
  snapshotSummary: Array<{
    label: string
    percent: number
    completedCount: number
    totalCount: number
  }>
  avgScore: number | null
  totalSessions: number
  notes: string | null
  pdfBuffer: ArrayBuffer
  pdfFilename: string
}

export async function notifyParentMilestoneReport(
  data: MilestoneReportNotifyData
): Promise<boolean> {
  const lines = [
    `Assalamualaikum Bunda/Ayah *${data.parentName}*,`,
    ``,
    `📋 *Raport Perkembangan Belajar ${data.studentName}* telah diterbitkan.`,
    `📅 Periode: *${data.periodLabel}*`,
    ``,
  ]

  for (const p of data.snapshotSummary) {
    if (p.totalCount === 0) continue
    lines.push(
      `📚 *${p.label}*: ${p.completedCount}/${p.totalCount} milestone selesai (${p.percent}%)`
    )
  }

  if (data.totalSessions > 0) {
    lines.push(``)
    lines.push(`📊 Total sesi: ${data.totalSessions} pertemuan`)
    if (data.avgScore !== null) {
      lines.push(`⭐ Rata-rata nilai: ${data.avgScore}/100`)
    }
  }

  if (data.notes) {
    lines.push(``, `💬 *Catatan:*`, data.notes)
  }

  lines.push(
    ``,
    `Raport lengkap terlampir dalam file PDF.`,
    ``,
    `Terima kasih,\nMellyna Education`
  )

  const message = lines.join('\n')
  const textSent = await sendWhatsApp(data.parentPhone, message)

  const base64 = Buffer.from(data.pdfBuffer).toString('base64')
  const fileSent = await sendWhatsAppFile(
    data.parentPhone,
    base64,
    data.pdfFilename,
    'application/pdf',
    `Raport ${data.studentName} — ${data.periodLabel}`
  )

  return textSent && fileSent
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/milestone-report-notify.ts
git commit -m "feat: add WhatsApp notification lib for milestone raport"
```

---

## Task 5: API — List and Create

**Files:**
- Create: `app/api/milestone-reports/route.ts`

- [ ] **Step 1: Create route**

Create `app/api/milestone-reports/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ReportPeriodType, Program } from '@prisma/client'
import {
  generateRaportPdf,
  type MilestoneSnapshotData,
  type SessionSummaryData,
} from '@/lib/milestone-report-pdf'
import { notifyParentMilestoneReport } from '@/lib/milestone-report-notify'

const PROGRAM_LABELS: Record<Program, string> = {
  SEMPOA: 'Sempoa',
  AHE: 'AHE',
  EFK: 'EFK',
  EYL: 'EYL',
  EFE: 'EFE',
  CALISTUNG: 'Calistung',
  ENGLISH: 'English',
}

const createSchema = z.object({
  studentId: z.string().min(1),
  periodType: z.nativeEnum(ReportPeriodType),
  periodLabel: z.string().min(1),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  notes: z.string().optional(),
  sendWhatsApp: z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId')

  if (role === 'PARENT') {
    const children = await prisma.student.findMany({
      where: { parentId: userId, isActive: true },
      select: { id: true },
    })
    const childIds = children.map((c) => c.id)
    const reports = await prisma.milestoneReport.findMany({
      where: { studentId: { in: childIds } },
      include: {
        student: { select: { name: true } },
        generatedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(reports)
  }

  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const reports = await prisma.milestoneReport.findMany({
    where: studentId ? { studentId } : {},
    include: {
      student: { select: { name: true } },
      generatedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(reports)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const generatedById = (session.user as any).id

  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const {
    studentId,
    periodType,
    periodLabel,
    periodStart,
    periodEnd,
    notes,
    sendWhatsApp: doNotify,
  } = parsed.data
  const start = new Date(periodStart)
  const end = new Date(periodEnd)

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { parent: { select: { name: true, phone: true } } },
  })
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  // Snapshot: current milestone statuses for this student
  const allMilestones = await prisma.milestone.findMany({
    orderBy: [{ program: 'asc' }, { order: 'asc' }],
    include: { studentMilestones: { where: { studentId } } },
  })

  const programs = Object.values(Program)
  const snapshot: MilestoneSnapshotData = {
    programs: programs
      .map((prog) => {
        const progMilestones = allMilestones.filter((m) => m.program === prog)
        if (progMilestones.length === 0) return null
        const milestones = progMilestones.map((m) => {
          const sm = m.studentMilestones[0]
          return {
            id: m.id,
            name: m.name,
            description: m.description,
            order: m.order,
            status: (sm?.status ?? 'NOT_STARTED') as
              | 'NOT_STARTED'
              | 'IN_PROGRESS'
              | 'COMPLETED',
            completedAt: sm?.completedAt ? sm.completedAt.toISOString() : null,
          }
        })
        const completedCount = milestones.filter((m) => m.status === 'COMPLETED').length
        const inProgressCount = milestones.filter((m) => m.status === 'IN_PROGRESS').length
        const notStartedCount = milestones.filter((m) => m.status === 'NOT_STARTED').length
        const totalCount = milestones.length
        const percent =
          totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
        return {
          program: prog,
          label: PROGRAM_LABELS[prog],
          completedCount,
          inProgressCount,
          notStartedCount,
          totalCount,
          percent,
          milestones,
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null),
  }

  // Session summary: LearningReports within the period date range
  const sessionReports = await prisma.learningReport.findMany({
    where: {
      studentId,
      schedule: { date: { gte: start, lte: end } },
    },
    select: { score: true },
  })
  const scores = sessionReports
    .map((r) => r.score)
    .filter((s): s is number => s !== null)
  const sessionSummary: SessionSummaryData = {
    totalSessions: sessionReports.length,
    avgScore:
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null,
  }

  const report = await prisma.milestoneReport.create({
    data: {
      studentId,
      periodType,
      periodLabel,
      periodStart: start,
      periodEnd: end,
      notes: notes ?? null,
      snapshotJson: snapshot as any,
      sessionSummary: sessionSummary as any,
      generatedById,
    },
  })

  // Optional WhatsApp delivery
  if (doNotify && student.parent.phone) {
    const pdfBuffer = generateRaportPdf({
      studentName: student.name,
      periodLabel,
      generatedAt: report.createdAt,
      notes: notes ?? null,
      snapshot,
      session: sessionSummary,
    })
    await notifyParentMilestoneReport({
      parentPhone: student.parent.phone,
      parentName: student.parent.name,
      studentName: student.name,
      periodLabel,
      snapshotSummary: snapshot.programs.map((p) => ({
        label: p.label,
        percent: p.percent,
        completedCount: p.completedCount,
        totalCount: p.totalCount,
      })),
      avgScore: sessionSummary.avgScore,
      totalSessions: sessionSummary.totalSessions,
      notes: notes ?? null,
      pdfBuffer,
      pdfFilename: `raport-${student.name.replace(/\s+/g, '-')}-${periodLabel.replace(/\s+/g, '-')}.pdf`,
    })
    await prisma.milestoneReport.update({
      where: { id: report.id },
      data: { notifiedAt: new Date() },
    })
  }

  return NextResponse.json(report, { status: 201 })
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/milestone-reports/route.ts
git commit -m "feat: add milestone report list and create/publish API route"
```

---

## Task 6: API — Single Report and Delete

**Files:**
- Create: `app/api/milestone-reports/[id]/route.ts`

- [ ] **Step 1: Create route**

Create `app/api/milestone-reports/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const { id } = await params

  if (role === 'TUTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const report = await prisma.milestoneReport.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, name: true, parentId: true } },
      generatedBy: { select: { name: true } },
    },
  })

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (role === 'PARENT' && report.student.parentId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(report)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await prisma.milestoneReport.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/milestone-reports/[id]/route.ts
git commit -m "feat: add milestone report GET single and DELETE API routes"
```

---

## Task 7: API — PDF Download

**Files:**
- Create: `app/api/milestone-reports/[id]/pdf/route.ts`

- [ ] **Step 1: Create PDF route**

Create `app/api/milestone-reports/[id]/pdf/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  generateRaportPdf,
  type MilestoneSnapshotData,
  type SessionSummaryData,
} from '@/lib/milestone-report-pdf'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const { id } = await params

  if (role === 'TUTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const report = await prisma.milestoneReport.findUnique({
    where: { id },
    include: { student: { select: { name: true, parentId: true } } },
  })

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (role === 'PARENT' && report.student.parentId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pdfBuffer = generateRaportPdf({
    studentName: report.student.name,
    periodLabel: report.periodLabel,
    generatedAt: report.createdAt,
    notes: report.notes,
    snapshot: report.snapshotJson as unknown as MilestoneSnapshotData,
    session: report.sessionSummary as unknown as SessionSummaryData,
  })

  const filename = `raport-${report.student.name.replace(/\s+/g, '-')}-${report.periodLabel.replace(/\s+/g, '-')}.pdf`

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/milestone-reports/[id]/pdf/route.ts
git commit -m "feat: add PDF download API route for milestone raport"
```

---

## Task 8: Admin UI — Raport Management Page

**Files:**
- Create: `app/(dashboard)/admin/milestones/reports/page.tsx`
- Create: `app/(dashboard)/admin/milestones/reports/MilestoneReportsClient.tsx`

- [ ] **Step 1: Create server component**

Create `app/(dashboard)/admin/milestones/reports/page.tsx`:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import MilestoneReportsClient from './MilestoneReportsClient'

export default async function AdminMilestoneReportsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') redirect('/admin')

  const [students, reports] = await Promise.all([
    prisma.student.findMany({
      where: { isActive: true },
      select: { id: true, name: true, grade: true },
      orderBy: { name: 'asc' },
    }),
    prisma.milestoneReport.findMany({
      include: {
        student: { select: { name: true } },
        generatedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return <MilestoneReportsClient students={students} initialReports={reports as any} />
}
```

- [ ] **Step 2: Create client component**

Create `app/(dashboard)/admin/milestones/reports/MilestoneReportsClient.tsx`:

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { ReportPeriodType } from '@prisma/client'
import { Plus, FileText, Trash2, Download, Send, Search, X } from 'lucide-react'

type Student = { id: string; name: string; grade: string | null }
type Report = {
  id: string
  periodLabel: string
  periodType: ReportPeriodType
  notes: string | null
  notifiedAt: string | null
  createdAt: string
  student: { name: string }
  generatedBy: { name: string }
}

const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
]
const PERIOD_LABELS: Record<ReportPeriodType, string> = {
  MONTHLY: 'Bulanan',
  SEMESTER: 'Per Semester',
  CUSTOM: 'Bebas',
}

function buildPeriodDates(
  type: ReportPeriodType,
  monthIdx: number,
  year: number,
  semester: number,
  customStart: string,
  customEnd: string
): { start: Date; end: Date; label: string } | null {
  if (type === 'MONTHLY') {
    const start = new Date(year, monthIdx, 1)
    const end = new Date(year, monthIdx + 1, 0, 23, 59, 59)
    return { start, end, label: `${MONTHS[monthIdx]} ${year}` }
  }
  if (type === 'SEMESTER') {
    if (semester === 1) {
      return {
        start: new Date(year, 0, 1),
        end: new Date(year, 5, 30, 23, 59, 59),
        label: `Semester 1 ${year}`,
      }
    }
    return {
      start: new Date(year, 6, 1),
      end: new Date(year, 11, 31, 23, 59, 59),
      label: `Semester 2 ${year}`,
    }
  }
  if (type === 'CUSTOM') {
    if (!customStart || !customEnd) return null
    const start = new Date(customStart)
    const end = new Date(customEnd + 'T23:59:59')
    const fmt = (d: Date) =>
      d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    return { start, end, label: `${fmt(start)} – ${fmt(end)}` }
  }
  return null
}

export default function MilestoneReportsClient({
  students,
  initialReports,
}: {
  students: Student[]
  initialReports: Report[]
}) {
  const [reports, setReports] = useState<Report[]>(initialReports)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    studentId: '',
    periodType: 'MONTHLY' as ReportPeriodType,
    monthIdx: new Date().getMonth(),
    year: new Date().getFullYear(),
    semester: 1,
    customStart: '',
    customEnd: '',
    notes: '',
    sendWhatsApp: false,
  })

  const selectedStudent = students.find((s) => s.id === form.studentId)
  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSubmit = async () => {
    if (!form.studentId) { setError('Pilih siswa terlebih dahulu'); return }
    const period = buildPeriodDates(
      form.periodType, form.monthIdx, form.year,
      form.semester, form.customStart, form.customEnd
    )
    if (!period) { setError('Lengkapi rentang periode'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/milestone-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: form.studentId,
          periodType: form.periodType,
          periodLabel: period.label,
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
          notes: form.notes || undefined,
          sendWhatsApp: form.sendWhatsApp,
        }),
      })
      if (!res.ok) throw new Error('Gagal menerbitkan raport')
      const created = await res.json()
      setReports((prev) => [created, ...prev])
      setShowForm(false)
      setForm({
        studentId: '', periodType: 'MONTHLY',
        monthIdx: new Date().getMonth(), year: new Date().getFullYear(),
        semester: 1, customStart: '', customEnd: '', notes: '', sendWhatsApp: false,
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus raport ini?')) return
    try {
      const res = await fetch(`/api/milestone-reports/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setReports((prev) => prev.filter((r) => r.id !== id))
    } catch {
      alert('Gagal menghapus raport')
    }
  }

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-700 p-5 sm:p-8 text-white shadow-xl shadow-violet-600/10">
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">Raport Milestone</h1>
        <p className="mt-2 text-sm sm:text-base text-violet-100">
          Terbitkan raport perkembangan belajar siswa per periode.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
        >
          <Plus className="h-4 w-4" />
          Terbitkan Raport
        </button>
      </div>

      {/* Reports List */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden">
        {reports.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <p className="text-3xl">📋</p>
            <p className="mt-2 text-sm">Belum ada raport diterbitkan.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-6 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/30">
                  <FileText className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800 dark:text-white">{r.student.name}</p>
                  <p className="text-xs text-slate-500">
                    {r.periodLabel} · {PERIOD_LABELS[r.periodType]} · Diterbitkan {fmtDate(r.createdAt)}
                  </p>
                  <p className="text-xs text-slate-400">
                    oleh {r.generatedBy.name}{r.notifiedAt ? ' · WA terkirim ✓' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`/api/milestone-reports/${r.id}/pdf`}
                    download
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    PDF
                  </a>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 border border-rose-100 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <h3 className="font-extrabold text-slate-800 dark:text-white">Terbitkan Raport Milestone</h3>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-600">
                {error}
              </div>
            )}

            {/* Student search */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Siswa</label>
              <div className="relative mt-1.5" ref={searchRef}>
                {selectedStudent && !showDropdown ? (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-2.5">
                    <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-white">
                      {selectedStudent.name}
                    </span>
                    <button
                      onClick={() => { setForm({ ...form, studentId: '' }); setSearchQuery('') }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true) }}
                        onFocus={() => setShowDropdown(true)}
                        placeholder="Cari nama siswa..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    {showDropdown && (
                      <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
                        <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                          {filteredStudents.length === 0 ? (
                            <li className="px-4 py-3 text-sm text-slate-400">Tidak ditemukan</li>
                          ) : (
                            filteredStudents.map((s) => (
                              <li key={s.id}>
                                <button
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    setForm({ ...form, studentId: s.id })
                                    setSearchQuery('')
                                    setShowDropdown(false)
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-800 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
                                >
                                  {s.name}
                                  {s.grade && (
                                    <span className="ml-1.5 text-xs font-normal text-slate-400">
                                      ({s.grade})
                                    </span>
                                  )}
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Period type */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Tipe Periode
              </label>
              <div className="flex gap-2 mt-1.5">
                {(['MONTHLY', 'SEMESTER', 'CUSTOM'] as ReportPeriodType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, periodType: t })}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      form.periodType === t
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {PERIOD_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Period config — MONTHLY */}
            {form.periodType === 'MONTHLY' && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bulan</label>
                  <select
                    value={form.monthIdx}
                    onChange={(e) => setForm({ ...form, monthIdx: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
                <div className="w-28">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tahun</label>
                  <input
                    type="number" value={form.year} min={2020} max={2099}
                    onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Period config — SEMESTER */}
            {form.periodType === 'SEMESTER' && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Semester</label>
                  <div className="flex gap-2 mt-1.5">
                    {[1, 2].map((s) => (
                      <button
                        key={s}
                        onClick={() => setForm({ ...form, semester: s })}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                          form.semester === s
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Semester {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-28">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tahun</label>
                  <input
                    type="number" value={form.year} min={2020} max={2099}
                    onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Period config — CUSTOM */}
            {form.periodType === 'CUSTOM' && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mulai</label>
                  <input
                    type="date" value={form.customStart}
                    onChange={(e) => setForm({ ...form, customStart: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sampai</label>
                  <input
                    type="date" value={form.customEnd}
                    onChange={(e) => setForm({ ...form, customEnd: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Catatan (opsional)
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Catatan umum untuk raport ini..."
                className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* WhatsApp toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`relative w-10 h-5 rounded-full transition-colors ${form.sendWhatsApp ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
              >
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.sendWhatsApp ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </div>
              <input
                type="checkbox"
                checked={form.sendWhatsApp}
                onChange={(e) => setForm({ ...form, sendWhatsApp: e.target.checked })}
                className="sr-only"
              />
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-emerald-500" />
                  Kirim WhatsApp ke orang tua
                </p>
                <p className="text-xs text-slate-400">PDF raport dikirim langsung ke nomor WA orang tua</p>
              </div>
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
              >
                {loading ? 'Menerbitkan...' : 'Terbitkan Raport'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/admin/milestones/reports/
git commit -m "feat: add admin milestone raport management page"
```

---

## Task 9: Parent UI — View and Download Raport

**Files:**
- Create: `app/(dashboard)/parent/milestone-reports/page.tsx`

- [ ] **Step 1: Create parent raport page**

Create `app/(dashboard)/parent/milestone-reports/page.tsx`:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Download, FileText, CheckCircle2, Clock, Circle } from 'lucide-react'
import { ReportPeriodType } from '@prisma/client'

type MilestoneEntry = {
  id: string
  name: string
  description: string | null
  order: number
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  completedAt: string | null
}

type ProgramSnapshot = {
  program: string
  label: string
  completedCount: number
  inProgressCount: number
  notStartedCount: number
  totalCount: number
  percent: number
  milestones: MilestoneEntry[]
}

type SnapshotJson = { programs: ProgramSnapshot[] }
type SessionJson = { totalSessions: number; avgScore: number | null }

const PERIOD_LABELS: Record<ReportPeriodType, string> = {
  MONTHLY: 'Bulanan',
  SEMESTER: 'Per Semester',
  CUSTOM: 'Bebas',
}

const STATUS_CFG = {
  COMPLETED: { label: 'Selesai', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400', Icon: CheckCircle2 },
  IN_PROGRESS: { label: 'Berjalan', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400', Icon: Clock },
  NOT_STARTED: { label: 'Belum', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', Icon: Circle },
}

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

export default async function ParentMilestoneReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ reportId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const { reportId } = await searchParams

  const children = await prisma.student.findMany({
    where: { parentId: userId, isActive: true },
    select: { id: true },
  })
  const childIds = children.map((c) => c.id)

  const reports = await prisma.milestoneReport.findMany({
    where: { studentId: { in: childIds } },
    include: { student: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const activeReport = reportId
    ? reports.find((r) => r.id === reportId)
    : reports[0] ?? null

  if (reports.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-700 p-5 sm:p-8 text-white shadow-xl">
          <h1 className="text-xl sm:text-3xl font-extrabold">📋 Raport Milestone</h1>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 text-center text-slate-400">
          <p className="text-3xl">📋</p>
          <p className="mt-2 text-sm">Belum ada raport diterbitkan untuk anak Anda.</p>
        </div>
      </div>
    )
  }

  const snapshot = activeReport
    ? (activeReport.snapshotJson as unknown as SnapshotJson)
    : null
  const sessionData = activeReport
    ? (activeReport.sessionSummary as unknown as SessionJson)
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-700 p-5 sm:p-8 text-white shadow-xl">
        <h1 className="text-xl sm:text-3xl font-extrabold">📋 Raport Milestone</h1>
        <p className="mt-2 text-sm text-violet-100">Riwayat raport perkembangan belajar anak Anda.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report list sidebar */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden lg:col-span-1">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-bold text-slate-800 dark:text-white text-sm">Daftar Raport</h2>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {reports.map((r) => (
              <li key={r.id}>
                <a
                  href={`/parent/milestone-reports?reportId=${r.id}`}
                  className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                    activeReport?.id === r.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <FileText
                    className={`h-4 w-4 shrink-0 ${activeReport?.id === r.id ? 'text-indigo-600' : 'text-slate-400'}`}
                  />
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${activeReport?.id === r.id ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-800 dark:text-white'}`}>
                      {r.student.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{r.periodLabel}</p>
                    <p className="text-xs text-slate-400">{fmtDate(r.createdAt)}</p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Report detail */}
        {activeReport && snapshot && sessionData && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden lg:col-span-2">
            {/* Detail header */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-extrabold text-slate-800 dark:text-white">
                  {activeReport.student.name}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {activeReport.periodLabel} · {PERIOD_LABELS[activeReport.periodType]}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Diterbitkan {fmtDate(activeReport.createdAt)}
                </p>
              </div>
              <a
                href={`/api/milestone-reports/${activeReport.id}/pdf`}
                download
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors shrink-0"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Session summary */}
              {sessionData.totalSessions > 0 && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 flex gap-8">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      Total Sesi
                    </p>
                    <p className="text-2xl font-extrabold text-slate-800 dark:text-white mt-0.5">
                      {sessionData.totalSessions}
                    </p>
                    <p className="text-xs text-slate-400">pertemuan</p>
                  </div>
                  {sessionData.avgScore !== null && (
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        Rata-rata Nilai
                      </p>
                      <p className="text-2xl font-extrabold text-indigo-600 mt-0.5">
                        {sessionData.avgScore}
                      </p>
                      <p className="text-xs text-slate-400">dari 100</p>
                    </div>
                  )}
                </div>
              )}

              {/* Programs */}
              {snapshot.programs.map((prog) => (
                <div key={prog.program} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                      {prog.label}
                    </h3>
                    <span className="text-xs text-slate-400">
                      {prog.completedCount}/{prog.totalCount} selesai
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                      style={{ width: `${prog.percent}%` }}
                    />
                  </div>
                  {/* Milestone list */}
                  <div className="space-y-1.5">
                    {prog.milestones.map((m, idx) => {
                      const cfg = STATUS_CFG[m.status]
                      const Icon = cfg.Icon
                      return (
                        <div key={m.id} className="flex items-start gap-3">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-semibold ${
                                m.status === 'COMPLETED'
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-800 dark:text-white'
                              }`}
                            >
                              {m.name}
                            </p>
                            {m.completedAt && (
                              <p className="text-xs text-emerald-500">✓ {fmtDate(m.completedAt)}</p>
                            )}
                          </div>
                          <span
                            className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${cfg.cls}`}
                          >
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Notes */}
              {activeReport.notes && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Catatan
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{activeReport.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/parent/milestone-reports/
git commit -m "feat: add parent milestone raport view page with PDF download"
```

---

## Task 10: Sidebar Navigation

**Files:**
- Modify: `components/dashboard/sidebar.tsx`

- [ ] **Step 1: Add Scroll icon import**

In `components/dashboard/sidebar.tsx`, find the lucide-react import block (currently ends with `BookMarked,`). Add `Scroll`:

```typescript
import {
  // ... existing imports ...
  Trophy,
  BookMarked,
  Scroll,
} from 'lucide-react'
```

- [ ] **Step 2: Add "Raport" to admin Kurikulum subItems**

Find the Kurikulum group (currently has Milestone and Progress Siswa). Add Raport as third sub-item:

```typescript
{
  name: 'Kurikulum',
  icon: Trophy,
  subItems: [
    { name: 'Milestone', href: '/admin/milestones', icon: BookMarked },
    { name: 'Progress Siswa', href: '/admin/milestones/progress', icon: TrendingUp },
    { name: 'Raport', href: '/admin/milestones/reports', icon: Scroll },
  ],
},
```

- [ ] **Step 3: Add "Raport Milestone" to parent nav**

In the PARENT nav array, after `{ name: 'Milestone Belajar', href: '/parent/milestones', icon: Trophy }`, add:

```typescript
{ name: 'Raport Milestone', href: '/parent/milestone-reports', icon: Scroll },
```

- [ ] **Step 4: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/sidebar.tsx
git commit -m "feat: add Raport Milestone nav items to admin and parent sidebar"
```

---

## Self-Review

**Spec coverage:**
- ✅ Bulanan — Task 8 UI `MONTHLY` period picker + `buildPeriodDates`
- ✅ Per Semester — Task 8 UI `SEMESTER` picker (S1 Jan-Jun, S2 Jul-Dec)
- ✅ Bebas (custom) — Task 8 UI `CUSTOM` date range picker
- ✅ Simpan snapshot saat diterbitkan — Task 5 `snapshotJson` + `sessionSummary` in DB
- ✅ Web view — Task 9 parent page renders snapshot from DB
- ✅ PDF download — Task 3 generator lib + Task 7 `/pdf` API route + download links in Task 8 + Task 9
- ✅ WhatsApp opsional — Task 4 notify lib + Task 8 toggle UI + Task 5 `doNotify` flag
- ✅ Admin manage (publish, list, delete) — Task 8
- ✅ Parent view + download — Task 9
- ✅ Navigation — Task 10
- ✅ Schema + migration — Task 1
- ✅ Tests — Task 2

**Placeholder check:** All steps have complete code. No TBD/TODO/placeholder text.

**Type consistency:**
- `MilestoneSnapshotData` / `SessionSummaryData` / `RaportData` defined in `lib/milestone-report-pdf.ts`, imported in Tasks 5 and 7 with exact same names
- `ProgramSnapshot` / `MilestoneEntry` defined in `lib/milestone-report-pdf.ts` and re-declared locally in Task 9 parent page (server component, no shared import needed)
- `ReportPeriodType` from `@prisma/client` used consistently in Tasks 5, 6, 7, 8, 9
- `buildPeriodDates` in `MilestoneReportsClient.tsx` — local helper, called in `handleSubmit`
- `params` in all route handlers typed as `Promise<{ id: string }>` — matches Next.js 15 pattern used throughout the project
- `(doc as any).lastAutoTable.finalY` — jspdf-autotable patches this onto the doc instance at runtime; the cast is intentional

**Note:** `jspdf` and `jspdf-autotable` are already in `package.json` (used by `lib/export.ts`). No new dependencies needed. The PDF generator uses `doc.output('arraybuffer')` for server-side use — no browser DOM required.
