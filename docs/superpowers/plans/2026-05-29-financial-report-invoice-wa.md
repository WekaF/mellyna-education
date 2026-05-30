# Financial Report & Invoice PDF via WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah halaman laporan keuangan admin yang rapi + fitur generate invoice PDF dan kirim ke WA orang tua.

**Architecture:** Server-side PDF generation via `pdfkit` in API routes, delivered to browser as stream or sent via WAHA `/api/sendFile` (base64). Financial report page reuses existing `/api/invoices` with added month/year/class filters. Billing page gets per-row action buttons.

**Tech Stack:** pdfkit, Next.js 15 App Router, WAHA HTTP API, Prisma, TailwindCSS, jsPDF (browser, existing, for report export only)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `lib/invoice-pdf.ts` | Server-side PDF buffer generator (pdfkit) |
| Create | `app/api/invoices/[id]/pdf/route.ts` | GET → stream PDF response |
| Create | `app/api/invoices/[id]/send-wa/route.ts` | POST → generate PDF + send via WAHA |
| Create | `app/api/admin/financial-report/summary/route.ts` | GET → aggregated totals by status |
| Create | `app/(dashboard)/admin/financial-report/page.tsx` | Admin financial report page |
| Modify | `lib/waha.ts` | Add `sendWhatsAppFile()` |
| Modify | `app/api/invoices/route.ts` | Add `month`, `year`, `classId` query filter |
| Modify | `app/(dashboard)/admin/billing/page.tsx` | Add PDF download + Send WA action buttons |
| Modify | `components/dashboard/sidebar.tsx` | Add "Laporan Keuangan" to Billing submenu |
| Create | `__tests__/lib/invoice-pdf.test.ts` | Unit test PDF generation |
| Create | `__tests__/lib/waha-file.test.ts` | Unit test sendWhatsAppFile |

---

## Task 1: Install pdfkit

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install pdfkit and types**

```bash
pnpm add pdfkit
pnpm add -D @types/pdfkit
```

- [ ] **Step 2: Verify installed**

```bash
node -e "require('pdfkit'); console.log('ok')"
```

Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add pdfkit for server-side invoice PDF generation"
```

---

## Task 2: Server-side Invoice PDF Generator

**Files:**
- Create: `lib/invoice-pdf.ts`
- Create: `__tests__/lib/invoice-pdf.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/invoice-pdf.test.ts`:

```typescript
import { generateInvoicePdf, type InvoiceData } from '@/lib/invoice-pdf'

const mockInvoice: InvoiceData = {
  id: 'cltest123456',
  description: 'Biaya Bimbel Bulan Juni 2026',
  amount: 500000,
  dueDate: new Date('2026-06-30'),
  status: 'PENDING',
  paidAt: null,
  createdAt: new Date('2026-06-01'),
  student: {
    name: 'Budi Santoso',
    grade: 'Kelas 3 SD',
    parent: {
      name: 'Santoso Hadi',
      phone: '08123456789',
      email: 'santoso@example.com',
    },
  },
}

describe('generateInvoicePdf', () => {
  it('returns a Buffer', async () => {
    const result = await generateInvoicePdf(mockInvoice)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(1000)
  })

  it('PDF starts with %PDF magic bytes', async () => {
    const result = await generateInvoicePdf(mockInvoice)
    expect(result.toString('ascii', 0, 4)).toBe('%PDF')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test __tests__/lib/invoice-pdf.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/invoice-pdf'`

- [ ] **Step 3: Implement `lib/invoice-pdf.ts`**

```typescript
import PDFDocument from 'pdfkit'

export interface InvoiceData {
  id: string
  description: string
  amount: number
  dueDate: Date
  status: string
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

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'BELUM LUNAS',
  PAID: 'LUNAS',
  OVERDUE: 'TERLAMBAT',
  CANCELLED: 'DIBATALKAN',
}

function formatRp(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}

function invoiceNumber(invoice: InvoiceData): string {
  const y = invoice.createdAt.getFullYear()
  const m = String(invoice.createdAt.getMonth() + 1).padStart(2, '0')
  const suffix = invoice.id.slice(-6).toUpperCase()
  return `INV-${y}${m}-${suffix}`
}

export function generateInvoicePdf(invoice: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageW = doc.page.width
    const invNo = invoiceNumber(invoice)

    // ── Header band ──────────────────────────────────────────────
    doc.rect(0, 0, pageW, 100).fill('#3730a3')
    doc
      .fill('#ffffff')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('MELLYNA EDUCATION', 50, 28)
    doc
      .fontSize(9)
      .font('Helvetica')
      .text('Bimbingan Belajar & Kursus Sempoa  •  info@mellynaeducation.id', 50, 58)
      .text('Yogyakarta, Indonesia', 50, 72)

    // ── Invoice meta (left) ───────────────────────────────────────
    doc.fill('#1e293b').fontSize(20).font('Helvetica-Bold').text('INVOICE', 50, 122)
    doc.fontSize(9).font('Helvetica').fill('#64748b')
    doc.text(`No. Invoice   : ${invNo}`, 50, 150)
    doc.text(`Tanggal       : ${formatDate(invoice.createdAt)}`, 50, 164)
    doc.text(`Jatuh Tempo   : ${formatDate(invoice.dueDate)}`, 50, 178)

    // ── Billed to (right) ─────────────────────────────────────────
    doc.fill('#374151').fontSize(9).font('Helvetica-Bold').text('TAGIHAN KEPADA:', 360, 122)
    doc.fill('#1e293b').fontSize(9).font('Helvetica')
    doc.text(invoice.student.parent.name, 360, 138, { width: 180 })
    if (invoice.student.parent.phone) doc.text(`HP: ${invoice.student.parent.phone}`, 360, 152)
    doc.text(invoice.student.parent.email, 360, 166, { width: 180 })
    doc.text(
      `Siswa: ${invoice.student.name}${invoice.student.grade ? ` (${invoice.student.grade})` : ''}`,
      360, 180, { width: 180 }
    )

    // ── Divider ───────────────────────────────────────────────────
    doc.moveTo(50, 210).lineTo(pageW - 50, 210).strokeColor('#e2e8f0').stroke()

    // ── Table header ──────────────────────────────────────────────
    doc.rect(50, 220, pageW - 100, 22).fill('#f1f5f9')
    doc.fill('#374151').fontSize(9).font('Helvetica-Bold')
    doc.text('KETERANGAN', 62, 228)
    doc.text('JUMLAH', pageW - 160, 228, { width: 110, align: 'right' })

    // ── Table row ─────────────────────────────────────────────────
    doc.rect(50, 242, pageW - 100, 30).strokeColor('#e2e8f0').stroke()
    doc.fill('#1e293b').fontSize(9).font('Helvetica')
    doc.text(invoice.description, 62, 252, { width: 370 })
    doc.text(formatRp(invoice.amount), pageW - 160, 252, { width: 110, align: 'right' })

    // ── Total row ─────────────────────────────────────────────────
    doc.moveTo(50, 286).lineTo(pageW - 50, 286).strokeColor('#cbd5e1').stroke()
    doc.rect(pageW - 210, 290, 160, 24).fill('#f8fafc')
    doc.fill('#1e293b').fontSize(10).font('Helvetica-Bold')
    doc.text('TOTAL:', pageW - 205, 297)
    doc.text(formatRp(invoice.amount), pageW - 160, 297, { width: 110, align: 'right' })

    // ── Status badge ──────────────────────────────────────────────
    const statusColors: Record<string, { bg: string; text: string }> = {
      PAID:      { bg: '#d1fae5', text: '#065f46' },
      PENDING:   { bg: '#fef3c7', text: '#92400e' },
      OVERDUE:   { bg: '#fee2e2', text: '#991b1b' },
      CANCELLED: { bg: '#f1f5f9', text: '#475569' },
    }
    const sc = statusColors[invoice.status] ?? statusColors['PENDING']
    const label = STATUS_LABELS[invoice.status] ?? invoice.status
    doc.rect(50, 334, 160, 28).fill(sc.bg)
    doc.fill(sc.text).fontSize(12).font('Helvetica-Bold').text(label, 58, 343)

    // ── Payment note ──────────────────────────────────────────────
    doc.fill('#64748b').fontSize(8).font('Helvetica').text(
      'Pembayaran dapat dilakukan melalui portal atau transfer ke rekening yang tertera. ' +
      'Hubungi admin jika ada pertanyaan.',
      50, 380, { width: pageW - 100 }
    )

    // ── Footer ────────────────────────────────────────────────────
    doc.moveTo(50, 755).lineTo(pageW - 50, 755).strokeColor('#e2e8f0').stroke()
    doc.fill('#94a3b8').fontSize(7).font('Helvetica').text(
      `Diterbitkan oleh Mellyna Education  •  ${formatDate(new Date())}  •  Dokumen ini dibuat secara otomatis`,
      50, 762, { align: 'center', width: pageW - 100 }
    )

    doc.end()
  })
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pnpm test __tests__/lib/invoice-pdf.test.ts
```

Expected: PASS — 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/invoice-pdf.ts __tests__/lib/invoice-pdf.test.ts
git commit -m "feat: add server-side invoice PDF generator (pdfkit)"
```

---

## Task 3: Invoice PDF API Endpoint

**Files:**
- Create: `app/api/invoices/[id]/pdf/route.ts`

- [ ] **Step 1: Create `app/api/invoices/[id]/pdf/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateInvoicePdf } from '@/lib/invoice-pdf'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const invoice = await prisma.invoice.findUnique({
    where: { id },
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

  if (!invoice) return NextResponse.json({ error: 'Not Found' }, { status: 404 })

  const pdfBuffer = await generateInvoicePdf({
    id: invoice.id,
    description: invoice.description,
    amount: invoice.amount,
    dueDate: invoice.dueDate,
    status: invoice.status,
    paidAt: invoice.paidAt,
    createdAt: invoice.createdAt,
    student: invoice.student,
  })

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${id}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    },
  })
}
```

- [ ] **Step 2: Verify build compiles**

```bash
pnpm tsc --noEmit
```

Expected: No errors related to new file.

- [ ] **Step 3: Commit**

```bash
git add app/api/invoices/[id]/pdf/route.ts
git commit -m "feat: add GET /api/invoices/[id]/pdf endpoint to stream invoice PDF"
```

---

## Task 4: Extend WAHA with sendWhatsAppFile

**Files:**
- Modify: `lib/waha.ts`
- Create: `__tests__/lib/waha-file.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/waha-file.test.ts`:

```typescript
// Mock global fetch before importing
const mockFetch = jest.fn()
global.fetch = mockFetch

import { sendWhatsAppFile } from '@/lib/waha'

beforeEach(() => mockFetch.mockClear())

describe('sendWhatsAppFile', () => {
  it('calls WAHA sendFile endpoint with correct payload', async () => {
    mockFetch.mockResolvedValue({ ok: true } as Response)

    const result = await sendWhatsAppFile(
      '08123456789',
      'JVBERi0xLjQ=',
      'invoice.pdf',
      'application/pdf',
      'Invoice tagihan bimbel'
    )

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/sendFile')
    const body = JSON.parse(opts.body as string)
    expect(body.chatId).toBe('628123456789@c.us')
    expect(body.file.filename).toBe('invoice.pdf')
    expect(body.caption).toBe('Invoice tagihan bimbel')
  })

  it('returns false on WAHA error', async () => {
    mockFetch.mockResolvedValue({ ok: false } as Response)
    const result = await sendWhatsAppFile('08123456789', 'abc', 'f.pdf', 'application/pdf', '')
    expect(result).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test __tests__/lib/waha-file.test.ts
```

Expected: FAIL — `sendWhatsAppFile is not a function` or not exported.

- [ ] **Step 3: Add `sendWhatsAppFile` to `lib/waha.ts`**

Open [lib/waha.ts](lib/waha.ts). Append after the existing `getSessionStatus` function:

```typescript
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
    return res.ok
  } catch (e) {
    console.error('[Mellyna] WAHA sendFile failed:', e)
    return false
  }
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pnpm test __tests__/lib/waha-file.test.ts
```

Expected: PASS — 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/waha.ts __tests__/lib/waha-file.test.ts
git commit -m "feat: add sendWhatsAppFile to WAHA lib for PDF delivery"
```

---

## Task 5: Send Invoice via WhatsApp API

**Files:**
- Create: `app/api/invoices/[id]/send-wa/route.ts`

- [ ] **Step 1: Create `app/api/invoices/[id]/send-wa/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { sendWhatsAppFile, sendWhatsApp } from '@/lib/waha'
import { formatRupiah } from '@/lib/utils'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const invoice = await prisma.invoice.findUnique({
    where: { id },
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

  if (!invoice) return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })

  const phone = invoice.student.parent.phone
  if (!phone) {
    return NextResponse.json({ error: 'Orang tua tidak memiliki nomor HP' }, { status: 422 })
  }

  const pdfBuffer = await generateInvoicePdf({
    id: invoice.id,
    description: invoice.description,
    amount: invoice.amount,
    dueDate: invoice.dueDate,
    status: invoice.status,
    paidAt: invoice.paidAt,
    createdAt: invoice.createdAt,
    student: invoice.student,
  })

  const base64 = pdfBuffer.toString('base64')
  const y = invoice.createdAt.getFullYear()
  const m = String(invoice.createdAt.getMonth() + 1).padStart(2, '0')
  const invNo = `INV-${y}${m}-${invoice.id.slice(-6).toUpperCase()}`
  const filename = `${invNo}.pdf`

  const caption =
    `Halo ${invoice.student.parent.name},\n\n` +
    `Berikut kami lampirkan invoice tagihan bimbingan belajar untuk ${invoice.student.name}.\n\n` +
    `No. Invoice : ${invNo}\n` +
    `Keterangan  : ${invoice.description}\n` +
    `Nominal     : ${formatRupiah(invoice.amount)}\n` +
    `Jatuh Tempo : ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(invoice.dueDate)}\n\n` +
    `Terima kasih,\nMellyna Education`

  const sent = await sendWhatsAppFile(phone, base64, filename, 'application/pdf', caption)
  if (!sent) {
    return NextResponse.json({ error: 'Gagal mengirim via WhatsApp. Periksa koneksi WAHA.' }, { status: 502 })
  }

  return NextResponse.json({ success: true, invoiceNo: invNo, sentTo: phone })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: No errors from new file.

- [ ] **Step 3: Commit**

```bash
git add app/api/invoices/[id]/send-wa/route.ts
git commit -m "feat: add POST /api/invoices/[id]/send-wa to deliver invoice PDF via WhatsApp"
```

---

## Task 6: Billing Page Action Buttons

**Files:**
- Modify: `app/(dashboard)/admin/billing/page.tsx`

The current billing page has no `id` in the `Invoice` interface and no action column. We need to:
1. Add `id` to the `Invoice` interface (line 9–16)
2. Add action column at the end of `columns` (line 140–179)
3. Add `sendingWA` and `waResult` state for feedback

- [ ] **Step 1: Add `id` to Invoice interface**

In [app/(dashboard)/admin/billing/page.tsx](app/(dashboard)/admin/billing/page.tsx), change the interface at line 9:

Old:
```typescript
interface Invoice {
  id: string
  description: string
  amount: number
  dueDate: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  student: { name: string }
}
```

New (no change needed — `id` is already there ✓). Confirm and move on.

- [ ] **Step 2: Add state for WA send feedback**

After `const [remindResult, setRemindResult] = useState<...>(null)` (around line 34), add:

```typescript
const [sendingWAId, setSendingWAId] = useState<string | null>(null)
const [waFeedback, setWaFeedback] = useState<{ id: string; ok: boolean; msg: string } | null>(null)
```

- [ ] **Step 3: Add `handleSendWA` and `handleDownloadPDF` handlers**

Add after `handleBulkSubmit` (before the `columns` definition):

```typescript
const handleDownloadPDF = (invoiceId: string) => {
  window.open(`/api/invoices/${invoiceId}/pdf`, '_blank')
}

const handleSendWA = async (invoiceId: string) => {
  setSendingWAId(invoiceId)
  setWaFeedback(null)
  try {
    const res = await fetch(`/api/invoices/${invoiceId}/send-wa`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Gagal mengirim')
    setWaFeedback({ id: invoiceId, ok: true, msg: `Invoice terkirim ke ${data.sentTo}` })
  } catch (err: any) {
    setWaFeedback({ id: invoiceId, ok: false, msg: err.message })
  } finally {
    setSendingWAId(null)
  }
}
```

- [ ] **Step 4: Add Actions column to `columns`**

At the end of the `columns` array (after the `status` column, before `], [])`), add:

```typescript
{
  id: 'actions',
  header: 'Aksi',
  cell: ({ row }) => {
    const inv = row.original
    const sending = sendingWAId === inv.id
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => handleDownloadPDF(inv.id)}
          title="Download PDF"
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
        >
          PDF
        </button>
        <button
          onClick={() => handleSendWA(inv.id)}
          disabled={sending}
          title="Kirim Invoice via WhatsApp"
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {sending ? '...' : 'WA'}
        </button>
      </div>
    )
  },
},
```

- [ ] **Step 5: Show WA feedback banner**

After the `remindResult` banner block (around line 222), add:

```tsx
{waFeedback && (
  <div className={`rounded-xl border px-4 py-3 text-sm flex items-center justify-between ${
    waFeedback.ok
      ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
      : 'bg-rose-50 border-rose-100 text-rose-600'
  }`}>
    <span>{waFeedback.ok ? '✅' : '⚠️'} {waFeedback.msg}</span>
    <button onClick={() => setWaFeedback(null)} className="ml-3 font-bold cursor-pointer opacity-60 hover:opacity-100">✕</button>
  </div>
)}
```

- [ ] **Step 6: Verify build**

```bash
pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add app/\(dashboard\)/admin/billing/page.tsx
git commit -m "feat: add PDF download and Send WA buttons to billing page action column"
```

---

## Task 7: Filter Support in /api/invoices + Summary Endpoint

**Files:**
- Modify: `app/api/invoices/route.ts`
- Create: `app/api/admin/financial-report/summary/route.ts`

- [ ] **Step 1: Add month/year/classId filters to GET /api/invoices**

In [app/api/invoices/route.ts](app/api/invoices/route.ts), replace the entire `GET` handler (lines 14–36):

```typescript
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null
  const classId = searchParams.get('classId') ?? null

  const dateFilter =
    month !== null && year !== null
      ? {
          createdAt: {
            gte: new Date(year, month - 1, 1),
            lt: new Date(year, month, 1),
          },
        }
      : year !== null
      ? {
          createdAt: {
            gte: new Date(year, 0, 1),
            lt: new Date(year + 1, 0, 1),
          },
        }
      : {}

  const classFilter =
    classId
      ? {
          student: {
            enrollments: { some: { classId } },
          },
        }
      : {}

  let invoices
  if (role === 'PARENT') {
    invoices = await prisma.invoice.findMany({
      where: { student: { parentId: userId }, ...dateFilter },
      include: { student: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
  } else {
    invoices = await prisma.invoice.findMany({
      where: { ...dateFilter, ...classFilter },
      include: { student: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  return NextResponse.json(invoices)
}
```

- [ ] **Step 2: Create `app/api/admin/financial-report/summary/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null
  const classId = searchParams.get('classId') ?? null

  const dateFilter =
    month !== null && year !== null
      ? { createdAt: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } }
      : year !== null
      ? { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } }
      : {}

  const classFilter = classId ? { student: { enrollments: { some: { classId } } } } : {}

  const invoices = await prisma.invoice.findMany({
    where: { ...dateFilter, ...classFilter },
    select: { amount: true, status: true },
  })

  const summary = {
    total:     { count: invoices.length,                                                  amount: invoices.reduce((s, i) => s + i.amount, 0) },
    paid:      { count: invoices.filter(i => i.status === 'PAID').length,      amount: invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0) },
    pending:   { count: invoices.filter(i => i.status === 'PENDING').length,   amount: invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.amount, 0) },
    overdue:   { count: invoices.filter(i => i.status === 'OVERDUE').length,   amount: invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.amount, 0) },
    cancelled: { count: invoices.filter(i => i.status === 'CANCELLED').length, amount: invoices.filter(i => i.status === 'CANCELLED').reduce((s, i) => s + i.amount, 0) },
  }

  return NextResponse.json(summary)
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/invoices/route.ts app/api/admin/financial-report/summary/route.ts
git commit -m "feat: add month/year/class filters to invoices API and financial-report summary endpoint"
```

---

## Task 8: Financial Report Page

**Files:**
- Create: `app/(dashboard)/admin/financial-report/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/common/DataTable'
import { formatRupiah } from '@/lib/utils'
import { exportToExcel, exportToPDF } from '@/lib/export'

interface Invoice {
  id: string
  description: string
  amount: number
  dueDate: string
  createdAt: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  student: { name: string }
}

interface Summary {
  total:     { count: number; amount: number }
  paid:      { count: number; amount: number }
  pending:   { count: number; amount: number }
  overdue:   { count: number; amount: number }
  cancelled: { count: number; amount: number }
}

const statusConfig = {
  PENDING:   { label: 'Belum Lunas', color: 'bg-amber-100 text-amber-700' },
  PAID:      { label: 'Lunas',       color: 'bg-emerald-100 text-emerald-700' },
  OVERDUE:   { label: 'Terlambat',   color: 'bg-rose-100 text-rose-700' },
  CANCELLED: { label: 'Dibatalkan',  color: 'bg-slate-100 text-slate-600' },
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)
const MONTHS = [
  { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' }, { value: '4', label: 'April' },
  { value: '5', label: 'Mei' }, { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' }, { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' }, { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
]

function SummaryCard({
  label, count, amount, colorClass,
}: { label: string; count: number; amount: number; colorClass: string }) {
  return (
    <div className={`rounded-2xl p-5 border shadow-xs ${colorClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-extrabold">{formatRupiah(amount)}</p>
      <p className="text-xs mt-1 opacity-60">{count} invoice</p>
    </div>
  )
}

export default function FinancialReportPage() {
  const now = new Date()
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [classId, setClassId] = useState('')
  const [classList, setClassList] = useState<{ id: string; name: string }[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const buildParams = useCallback(() => {
    const p = new URLSearchParams({ month, year })
    if (classId) p.set('classId', classId)
    return p.toString()
  }, [month, year, classId])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const qs = buildParams()
    const [invRes, sumRes] = await Promise.all([
      fetch(`/api/invoices?${qs}`),
      fetch(`/api/admin/financial-report/summary?${qs}`),
    ])
    setInvoices(await invRes.json())
    setSummary(await sumRes.json())
    setLoading(false)
  }, [buildParams])

  useEffect(() => {
    fetch('/api/classes').then(r => r.json()).then(setClassList).catch(() => {})
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const monthLabel = MONTHS.find(m => m.value === month)?.label ?? month

  const handleExportExcel = () => {
    const rows = invoices.map(inv => ({
      'Tanggal': new Date(inv.createdAt).toLocaleDateString('id-ID'),
      'Siswa': inv.student.name,
      'Keterangan': inv.description,
      'Nominal': inv.amount,
      'Jatuh Tempo': new Date(inv.dueDate).toLocaleDateString('id-ID'),
      'Status': statusConfig[inv.status].label,
    }))
    exportToExcel(rows, `Laporan-Keuangan-${monthLabel}-${year}`, 'Laporan Keuangan')
  }

  const handleExportPDF = async () => {
    setExporting(true)
    const cols = ['Tanggal', 'Siswa', 'Keterangan', 'Nominal', 'Jatuh Tempo', 'Status']
    const rows = invoices.map(inv => [
      new Date(inv.createdAt).toLocaleDateString('id-ID'),
      inv.student.name,
      inv.description,
      formatRupiah(inv.amount),
      new Date(inv.dueDate).toLocaleDateString('id-ID'),
      statusConfig[inv.status].label,
    ])
    await exportToPDF(cols, rows, `Laporan-Keuangan-${monthLabel}-${year}`, `Laporan Keuangan — ${monthLabel} ${year}`)
    setExporting(false)
  }

  const columns = useMemo<ColumnDef<Invoice>[]>(() => [
    {
      id: 'createdAt',
      accessorFn: row => new Date(row.createdAt).toLocaleDateString('id-ID'),
      header: 'Tanggal',
      cell: ({ getValue }) => <span className="text-slate-500 text-xs">{getValue() as string}</span>,
    },
    {
      id: 'student',
      accessorFn: row => row.student.name,
      header: 'Siswa',
      cell: ({ getValue }) => <span className="font-semibold text-slate-800">{getValue() as string}</span>,
    },
    {
      accessorKey: 'description',
      header: 'Keterangan',
      cell: ({ getValue }) => <span className="text-slate-600">{getValue() as string}</span>,
    },
    {
      accessorKey: 'amount',
      header: 'Nominal',
      cell: ({ getValue }) => <span className="font-bold text-slate-800">{formatRupiah(getValue() as number)}</span>,
    },
    {
      id: 'dueDate',
      accessorFn: row => new Date(row.dueDate).toLocaleDateString('id-ID'),
      header: 'Jatuh Tempo',
      cell: ({ getValue }) => <span className="text-slate-500 text-xs">{getValue() as string}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const cfg = statusConfig[getValue() as Invoice['status']]
        return (
          <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>
            {cfg.label}
          </span>
        )
      },
    },
  ], [])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">📊 Laporan Keuangan</h1>
          <p className="text-sm text-slate-500 mt-0.5">Rekap pendapatan bimbel per periode.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleExportExcel}
            disabled={loading || invoices.length === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            disabled={loading || invoices.length === 0 || exporting}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            {exporting ? 'Membuat PDF...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Bulan</label>
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white min-w-[130px]"
          >
            {MONTHS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tahun</label>
          <select
            value={year}
            onChange={e => setYear(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white min-w-[90px]"
          >
            {YEARS.map(y => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Kelas</label>
          <select
            value={classId}
            onChange={e => setClassId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white min-w-[160px]"
          >
            <option value="">Semua Kelas</option>
            {classList.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Tagihan"  count={summary.total.count}   amount={summary.total.amount}   colorClass="bg-slate-50 border-slate-200 text-slate-800" />
          <SummaryCard label="Terbayar"       count={summary.paid.count}    amount={summary.paid.amount}    colorClass="bg-emerald-50 border-emerald-100 text-emerald-800" />
          <SummaryCard label="Belum Lunas"    count={summary.pending.count} amount={summary.pending.amount} colorClass="bg-amber-50 border-amber-100 text-amber-800" />
          <SummaryCard label="Terlambat"      count={summary.overdue.count} amount={summary.overdue.amount} colorClass="bg-rose-50 border-rose-100 text-rose-800" />
        </div>
      )}

      {/* Data table */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={invoices}
          loading={loading}
          searchPlaceholder="Cari siswa, keterangan, status..."
          emptyMessage="Tidak ada tagihan pada periode ini."
          emptyIcon="📊"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/admin/financial-report/page.tsx"
git commit -m "feat: add admin financial report page with summary cards, filters, and export"
```

---

## Task 9: Add Laporan Keuangan to Sidebar

**Files:**
- Modify: `components/dashboard/sidebar.tsx`

- [ ] **Step 1: Add `BarChart3` to lucide imports**

In [components/dashboard/sidebar.tsx](components/dashboard/sidebar.tsx) at line 8, add `BarChart3` to the import:

Old:
```typescript
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  CreditCard,
  Megaphone,
  TrendingUp,
  LogOut,
  Menu,
  X,
  Settings,
  FileText,
  BarChart2,
  Tag,
  Grid3x3,
  UsersRound,
  ChevronDown
} from 'lucide-react'
```

New:
```typescript
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  CreditCard,
  Megaphone,
  TrendingUp,
  LogOut,
  Menu,
  X,
  Settings,
  FileText,
  BarChart2,
  BarChart3,
  Tag,
  Grid3x3,
  UsersRound,
  ChevronDown
} from 'lucide-react'
```

- [ ] **Step 2: Add Laporan Keuangan to Billing submenu**

In the `SUPER_ADMIN` nav, find the Billing group (around line 87–93):

Old:
```typescript
{
  name: 'Billing',
  icon: CreditCard,
  subItems: [
    { name: 'Tagihan', href: '/admin/billing', icon: CreditCard },
    { name: 'Paket Harga', href: '/admin/pricing', icon: Tag },
  ],
},
```

New:
```typescript
{
  name: 'Billing',
  icon: CreditCard,
  subItems: [
    { name: 'Tagihan', href: '/admin/billing', icon: CreditCard },
    { name: 'Laporan Keuangan', href: '/admin/financial-report', icon: BarChart3 },
    { name: 'Paket Harga', href: '/admin/pricing', icon: Tag },
  ],
},
```

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/sidebar.tsx
git commit -m "feat: add Laporan Keuangan link to Billing sidebar submenu"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Laporan keuangan rapi → Task 8 (financial report page, summary cards, filters, table)
  - Invoice PDF → Task 2+3 (generateInvoicePdf, /api/invoices/[id]/pdf)
  - Kirim ke WA parent → Task 4+5 (sendWhatsAppFile, /api/invoices/[id]/send-wa)
  - Format invoice professional → Task 2 (pdfkit layout with header, table, total, status)
  - Export → Task 8 uses existing exportToExcel/exportToPDF from lib/export.ts

- [x] **No placeholders** — every step has complete code

- [x] **Type consistency:**
  - `InvoiceData` defined in `lib/invoice-pdf.ts`, used identically in both API routes
  - `sendWhatsAppFile` signature matches between `lib/waha.ts` and `send-wa/route.ts`
  - `Summary` type in financial-report page matches what `/api/admin/financial-report/summary` returns
