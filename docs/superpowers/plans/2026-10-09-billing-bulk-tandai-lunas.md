# Billing Bulk Tandai Lunas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Di halaman `/admin/billing`, admin bisa filter tagihan per status (mis. "Belum Lunas"), centang beberapa/semua tagihan, lalu tandai lunas sekaligus dalam satu aksi.

**Architecture:** Satu endpoint baru `POST /api/payments/manual/bulk` (1..500 invoice, satu interactive transaction: update status + buat `Payment` per invoice; invoice yang sudah PAID/CANCELLED dilewati, bukan error). UI tetap pakai `DataTable` existing tanpa diubah: tambah kolom checkbox (header checkbox pakai `table.getFilteredRowModel()` supaya "pilih semua" ikut hasil search), dropdown filter status client-side, bar aksi massal, dan modal "Tandai Lunas" existing di-generalisasi jadi multi-invoice (dipakai juga oleh tombol per-baris). Konstanta status yang bisa dibayar dipusatkan di `lib/invoice-status.ts` supaya API dan UI pakai aturan yang sama.

**Tech Stack:** Next.js 15 App Router, next-auth v4, Prisma 6, zod v4, @tanstack/react-table v8 via `components/common/DataTable`, Jest (`next/jest`, testEnvironment node).

---

## Kondisi Saat Ini (audit 2026-10-09)

- Halaman sudah berupa tabel (`DataTable` → tanstack). Yang belum ada: checkbox, filter status, aksi massal.
- "Tandai Lunas" sekarang per-baris: modal pilih metode (CASH / BRI_TRANSFER / OTHER) + catatan → `POST /api/payments/manual` (1 invoice) → transaction `invoice.update(PAID)` + `payment.create`.
- Filter yang ada hanya bulan/tahun (server-side, `GET /api/invoices?month&year`). Search box ada di dalam `DataTable` (global filter internal).
- Tombol "Tandai Lunas" muncul hanya untuk status `PENDING` dan `OVERDUE`. Aturan yang sama dipakai untuk checkbox.

## Keputusan Desain

| Hal | Keputusan | Alasan |
|---|---|---|
| Endpoint | Baru: `/api/payments/manual/bulk`, route lama tidak disentuh | Route lama punya test & kontrak 400-kalau-PAID; bulk butuh semantik "lewati", bukan gagal |
| UI per-baris | Ikut pakai endpoint bulk (array 1 id) | Satu modal, satu handler. Kalau `updated === 0` → tampilkan error seperti sebelumnya |
| Tagihan sudah PAID/CANCELLED dalam daftar | Dilewati, dihitung di `skipped` | Admin centang banyak; satu yang keburu lunas via Midtrans tidak boleh menggagalkan semua |
| Race dengan webhook Midtrans | Dalam transaction: `updateMany` dengan filter status; kalau `count` ≠ jumlah eligible → throw → rollback → 409 | Cegah `Payment` dobel untuk invoice yang lunas di tengah proses |
| Batas jumlah | Max 500 id per request | Satu bulan ~163 tagihan; 500 cukup longgar, tetap membatasi payload |
| "Pilih semua" | Header checkbox memilih semua tagihan **belum lunas yang lolos filter status + search** (semua halaman, bukan cuma halaman aktif) | Sesuai maksud "centang yang belum lunas terus bulk lunas" |
| Pilihan di-reset | Saat fetch ulang (ganti bulan/tahun, setelah aksi apa pun) dan saat ganti filter status | Cegah centang "nyangkut" di baris yang tidak terlihat |
| Metode bayar massal | Satu metode + satu catatan untuk semua yang dicentang | Kasus nyata: rekap transfer/tunai satu periode. Beda metode → lakukan per batch |

## File Structure

- Create: `lib/invoice-status.ts` — `PAYABLE_STATUSES` + `isPayable()`; satu sumber aturan "boleh ditandai lunas".
- Create: `app/api/payments/manual/bulk/route.ts` — endpoint bulk.
- Create: `__tests__/api/payments/manual-bulk.test.ts` — test endpoint.
- Modify: `app/(dashboard)/admin/billing/BillingClient.tsx` — filter status, kolom checkbox, bar aksi massal, modal generalisasi.

---

### Task 1: Helper status + endpoint bulk (TDD)

**Files:**
- Create: `lib/invoice-status.ts`
- Create: `app/api/payments/manual/bulk/route.ts`
- Test: `__tests__/api/payments/manual-bulk.test.ts`

- [ ] **Step 1: Buat helper status**

`lib/invoice-status.ts`:

```ts
export const PAYABLE_STATUSES = ['PENDING', 'OVERDUE'] as const

export function isPayable(status: string): boolean {
  return (PAYABLE_STATUSES as readonly string[]).includes(status)
}
```

- [ ] **Step 2: Tulis test yang gagal**

`__tests__/api/payments/manual-bulk.test.ts`:

```ts
import { POST } from '@/app/api/payments/manual/bulk/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/db', () => ({
  prisma: {
    invoice: { findMany: jest.fn(), updateMany: jest.fn() },
    payment: { createMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

const makeReq = (body: object) =>
  new NextRequest('http://localhost/api/payments/manual/bulk', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

describe('POST /api/payments/manual/bulk', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'ADMIN' } })
    // interactive transaction: jalankan callback dengan mock prisma sebagai tx
    ;(prisma.$transaction as jest.Mock).mockImplementation((fn: (tx: typeof prisma) => unknown) => fn(prisma))
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ invoiceIds: ['a'], method: 'CASH' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when role is PARENT', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'PARENT' } })
    const res = await POST(makeReq({ invoiceIds: ['a'], method: 'CASH' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 for empty invoiceIds', async () => {
    const res = await POST(makeReq({ invoiceIds: [], method: 'CASH' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for more than 500 invoiceIds', async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `id${i}`)
    const res = await POST(makeReq({ invoiceIds: ids, method: 'CASH' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid method', async () => {
    const res = await POST(makeReq({ invoiceIds: ['a'], method: 'GOPAY' }))
    expect(res.status).toBe(400)
  })

  it('marks only payable invoices PAID and creates one payment each', async () => {
    ;(prisma.invoice.findMany as jest.Mock).mockResolvedValue([
      { id: 'a', amount: 100000 },
      { id: 'b', amount: 250000 },
    ])
    ;(prisma.invoice.updateMany as jest.Mock).mockResolvedValue({ count: 2 })
    ;(prisma.payment.createMany as jest.Mock).mockResolvedValue({ count: 2 })

    // 'a' dikirim dua kali → harus di-dedupe; 'c' sudah PAID → tidak dikembalikan findMany
    const res = await POST(makeReq({ invoiceIds: ['a', 'a', 'b', 'c'], method: 'BRI_TRANSFER', notes: 'Rekap Oktober' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ updated: 2, skipped: 1 })

    const findArgs = (prisma.invoice.findMany as jest.Mock).mock.calls[0][0]
    expect(findArgs.where).toEqual({ id: { in: ['a', 'b', 'c'] }, status: { in: ['PENDING', 'OVERDUE'] } })

    const updateArgs = (prisma.invoice.updateMany as jest.Mock).mock.calls[0][0]
    expect(updateArgs.where).toEqual({ id: { in: ['a', 'b'] }, status: { in: ['PENDING', 'OVERDUE'] } })
    expect(updateArgs.data.status).toBe('PAID')

    const payData = (prisma.payment.createMany as jest.Mock).mock.calls[0][0].data
    expect(payData).toHaveLength(2)
    expect(payData[0]).toMatchObject({
      invoiceId: 'a',
      amount: 100000,
      method: 'BRI_TRANSFER',
      status: 'SUCCESS',
      midtransData: { notes: 'Rekap Oktober' },
    })
    expect(payData[1]).toMatchObject({ invoiceId: 'b', amount: 250000 })
  })

  it('returns updated 0 without writing when nothing is payable', async () => {
    ;(prisma.invoice.findMany as jest.Mock).mockResolvedValue([])
    const res = await POST(makeReq({ invoiceIds: ['c'], method: 'CASH' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ updated: 0, skipped: 1 })
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled()
    expect(prisma.payment.createMany).not.toHaveBeenCalled()
  })

  it('returns 409 and creates no payment when an invoice changed status mid-transaction', async () => {
    ;(prisma.invoice.findMany as jest.Mock).mockResolvedValue([
      { id: 'a', amount: 100000 },
      { id: 'b', amount: 250000 },
    ])
    // 'b' keburu lunas via webhook → hanya 1 ter-update
    ;(prisma.invoice.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    const res = await POST(makeReq({ invoiceIds: ['a', 'b'], method: 'CASH' }))
    expect(res.status).toBe(409)
    expect(prisma.payment.createMany).not.toHaveBeenCalled()
  })

  it('returns 500 when transaction fails unexpectedly', async () => {
    ;(prisma.$transaction as jest.Mock).mockRejectedValue(new Error('db down'))
    const res = await POST(makeReq({ invoiceIds: ['a'], method: 'CASH' }))
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 3: Jalankan test, pastikan gagal**

Run: `rtk npx jest __tests__/api/payments/manual-bulk.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/payments/manual/bulk/route'`

- [ ] **Step 4: Implementasi endpoint**

`app/api/payments/manual/bulk/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PAYABLE_STATUSES } from '@/lib/invoice-status'

const schema = z.object({
  invoiceIds: z.array(z.string().min(1)).min(1).max(500),
  method: z.enum(['CASH', 'BRI_TRANSFER', 'OTHER']),
  notes: z.string().optional(),
})

class StatusConflictError extends Error {}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const ids = [...new Set(parsed.data.invoiceIds)]
  const { method, notes } = parsed.data
  const payable = { in: [...PAYABLE_STATUSES] }
  const now = new Date()

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const eligible = await tx.invoice.findMany({
        where: { id: { in: ids }, status: payable },
        select: { id: true, amount: true },
      })
      if (eligible.length === 0) return 0

      const { count } = await tx.invoice.updateMany({
        where: { id: { in: eligible.map((i) => i.id) }, status: payable },
        data: { status: 'PAID', paidAt: now },
      })
      // status berubah di antara findMany & updateMany (mis. webhook Midtrans) → rollback, cegah Payment dobel
      if (count !== eligible.length) throw new StatusConflictError()

      await tx.payment.createMany({
        data: eligible.map((i) => ({
          invoiceId: i.id,
          amount: i.amount,
          method,
          status: 'SUCCESS' as const,
          paidAt: now,
          midtransData: notes ? { notes } : undefined,
        })),
      })
      return eligible.length
    })

    return NextResponse.json({ updated, skipped: ids.length - updated })
  } catch (err) {
    if (err instanceof StatusConflictError) {
      return NextResponse.json(
        { error: 'Status sebagian tagihan baru saja berubah. Muat ulang lalu coba lagi.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'Gagal menyimpan pembayaran.' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Jalankan test, pastikan lulus**

Run: `rtk npx jest __tests__/api/payments`
Expected: PASS — semua test di `manual-bulk.test.ts` dan `manual.test.ts` (lama tidak tersentuh).

- [ ] **Step 6: Type check**

Run: `rtk tsc --noEmit`
Expected: tidak ada error baru di `lib/invoice-status.ts` / `app/api/payments/manual/bulk/route.ts`. (Bandingkan dengan `tsc-output.txt` kalau ada error lama yang sudah ada sebelumnya.)

- [ ] **Step 7: Commit**

```bash
rtk git add lib/invoice-status.ts app/api/payments/manual/bulk/route.ts __tests__/api/payments/manual-bulk.test.ts
rtk git commit -m "feat(billing): endpoint bulk tandai lunas manual

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

### Task 2: UI — filter status, checkbox, aksi massal

**Files:**
- Modify: `app/(dashboard)/admin/billing/BillingClient.tsx`

Semua potongan di bawah adalah penggantian di file tersebut. Nomor baris mengacu ke versi sebelum Task ini (commit `c9bdd91`).

- [ ] **Step 1: Import helper**

Setelah baris `import { useConfirm } from '@/lib/hooks/use-confirm'` (baris 8) tambahkan:

```ts
import { isPayable } from '@/lib/invoice-status'
```

- [ ] **Step 2: Generalisasi state modal + state baru**

Ganti baris 60 (`const [manualPayModal, ...]`) dengan:

```ts
  const [manualPayModal, setManualPayModal] = useState<{ invoiceIds: string[]; title: string; amount: number } | null>(null)
```

Setelah baris 73 (`const [filterYear, ...]`) tambahkan:

```ts
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PAID' | 'CANCELLED'>('ALL')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [payResult, setPayResult] = useState<{ updated: number; skipped: number } | null>(null)

  const visibleInvoices = useMemo(() => {
    if (statusFilter === 'ALL') return invoices
    if (statusFilter === 'UNPAID') return invoices.filter((i) => isPayable(i.status))
    return invoices.filter((i) => i.status === statusFilter)
  }, [invoices, statusFilter])

  const selectedInvoices = useMemo(
    () => invoices.filter((i) => selected.has(i.id)),
    [invoices, selected],
  )
```

- [ ] **Step 3: Reset pilihan tiap fetch**

Di `fetchInvoices`, ganti `setInvoices(await res.json())` dengan:

```ts
      setInvoices(await res.json())
      setSelected(new Set())
```

- [ ] **Step 4: Ganti `handleManualPay` pakai endpoint bulk**

Ganti seluruh fungsi `handleManualPay` (baris 158–180) dengan:

```ts
  const handleManualPay = async () => {
    if (!manualPayModal) return
    setError(null)
    setPayResult(null)
    setManualSaving(true)
    try {
      const res = await fetch('/api/payments/manual/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds: manualPayModal.invoiceIds, method: manualMethod, notes: manualNotes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Gagal mencatat pembayaran.')
      if (data.updated === 0) throw new Error('Tagihan sudah lunas atau dibatalkan.')
      setManualPayModal(null)
      setManualNotes('')
      if (manualPayModal.invoiceIds.length > 1) setPayResult(data)
      await fetchInvoices()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setManualSaving(false)
    }
  }
```

- [ ] **Step 5: Kolom checkbox + tombol per-baris pakai state baru**

Di `columns` (`useMemo`, baris 280), sisipkan kolom ini sebagai elemen **pertama** array (sebelum kolom `student`):

```tsx
    {
      id: 'select',
      enableSorting: false,
      header: ({ table }) => {
        // ikut filter status + search DataTable, semua halaman
        const payable = table.getFilteredRowModel().rows.map((r) => r.original).filter((i) => isPayable(i.status))
        const allChecked = payable.length > 0 && payable.every((i) => selected.has(i.id))
        return (
          <input
            type="checkbox"
            aria-label="Pilih semua tagihan belum lunas"
            title="Pilih semua tagihan belum lunas"
            checked={allChecked}
            disabled={payable.length === 0}
            onChange={() =>
              setSelected((prev) => {
                const next = new Set(prev)
                payable.forEach((i) => (allChecked ? next.delete(i.id) : next.add(i.id)))
                return next
              })
            }
            className="h-4 w-4 accent-emerald-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
          />
        )
      },
      cell: ({ row }) => {
        const inv = row.original
        if (!isPayable(inv.status)) return null
        return (
          <input
            type="checkbox"
            aria-label={`Pilih tagihan ${inv.student.name}`}
            checked={selected.has(inv.id)}
            onChange={() =>
              setSelected((prev) => {
                const next = new Set(prev)
                if (next.has(inv.id)) next.delete(inv.id)
                else next.add(inv.id)
                return next
              })
            }
            className="h-4 w-4 accent-emerald-600 cursor-pointer"
          />
        )
      },
    },
```

Di tombol "Tandai Lunas" per-baris (baris 346), ganti `onClick` dengan:

```tsx
                onClick={() => setManualPayModal({ invoiceIds: [inv.id], title: inv.student.name, amount: inv.amount })}
```

Ganti dependency array `useMemo` columns (baris 387) dengan:

```ts
  ], [handleCancelInvoice, handleDeleteInvoice, handleDownloadPDF, handleSendWA, sendingWAId, selected])
```

- [ ] **Step 6: Dropdown filter status**

Di blok "Month/Year Filter", ganti `<span>` hitungan (baris 444–446) dengan:

```tsx
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sm:ml-3">Status:</span>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setSelected(new Set()) }}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          <option value="ALL">Semua</option>
          <option value="UNPAID">Belum Lunas</option>
          <option value="PAID">Lunas</option>
          <option value="CANCELLED">Dibatalkan</option>
        </select>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {visibleInvoices.length} tagihan ditemukan
        </span>
```

- [ ] **Step 7: Banner hasil + bar aksi massal**

Setelah blok `{remindResult && (...)}` (berakhir baris 459) tambahkan:

```tsx
      {payResult && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700 flex items-center justify-between">
          <span>✅ <strong>{payResult.updated}</strong> tagihan ditandai lunas{payResult.skipped > 0 && `, ${payResult.skipped} dilewati (sudah lunas/dibatalkan)`}.</span>
          <button onClick={() => setPayResult(null)} className="ml-3 text-emerald-500 hover:text-emerald-700 font-bold cursor-pointer">✕</button>
        </div>
      )}
```

Tepat sebelum `<div className="rounded-2xl bg-white border border-me-border shadow-brand overflow-hidden">` yang membungkus `DataTable` (baris 645) tambahkan:

```tsx
      {selectedInvoices.length > 0 && (
        <div className="sticky top-2 z-10 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-sm text-emerald-800">
            <strong>{selectedInvoices.length}</strong> tagihan dipilih · total{' '}
            <strong>{formatRupiah(selectedInvoices.reduce((sum, i) => sum + i.amount, 0))}</strong>
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="text-sm font-semibold px-4 py-2 rounded-xl bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
            >
              Batal Pilih
            </button>
            <button
              onClick={() => setManualPayModal({
                invoiceIds: selectedInvoices.map((i) => i.id),
                title: `${selectedInvoices.length} tagihan`,
                amount: selectedInvoices.reduce((sum, i) => sum + i.amount, 0),
              })}
              className="text-sm font-semibold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
            >
              Tandai Lunas ({selectedInvoices.length})
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 8: Modal + DataTable pakai data baru**

Di modal "Tandai Lunas Manual" ganti baris 600:

```tsx
              {manualPayModal.title} — {formatRupiah(manualPayModal.amount)}
```

Di `<DataTable ...>` (baris 646–654) ganti `data={invoices}` dengan:

```tsx
          data={visibleInvoices}
```

- [ ] **Step 9: Type check + lint**

Run: `rtk tsc --noEmit` lalu `rtk lint`
Expected: tidak ada error baru di `BillingClient.tsx`.

- [ ] **Step 10: Verifikasi manual di browser**

Run: `rtk npm run dev`, login admin, buka `http://localhost:3000/admin/billing`. Cek:
1. Filter Status "Belum Lunas" → hanya baris badge "Belum Lunas"/"Terlambat"; hitungan "N tagihan ditemukan" ikut berubah.
2. Baris Lunas/Dibatalkan tidak punya checkbox.
3. Header checkbox → semua tagihan belum lunas tercentang (cek halaman 2 kalau > 50 baris); bar hijau muncul dengan jumlah & total rupiah benar.
4. Ketik nama di search lalu klik header checkbox → hanya baris hasil search yang tercentang.
5. "Tandai Lunas (N)" → modal judul "N tagihan — Rp total" → pilih metode → Konfirmasi → banner "N tagihan ditandai lunas", baris berubah jadi Lunas, centang kosong.
6. Tombol "Tandai Lunas" per-baris masih jalan seperti sebelumnya (tanpa banner, baris jadi Lunas).
7. Ganti bulan → centang ter-reset.
8. Cek DB/halaman riwayat pembayaran: satu `Payment` per invoice dengan metode & catatan yang dipilih.

- [ ] **Step 11: Commit**

```bash
rtk git add "app/(dashboard)/admin/billing/BillingClient.tsx"
rtk git commit -m "feat(billing): filter status + centang massal tandai lunas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 12: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

---

## Di Luar Scope

- `POST /api/payments/manual` (single) tidak lagi dipanggil UI setelah Task 2, tapi dibiarkan (ada test, aman). Hapus nanti kalau mau bersih-bersih.
- Bulk cancel / bulk hapus / bulk kirim WA — tidak diminta.
- Notifikasi WA "lunas" ke orang tua saat bulk — route single juga tidak mengirim, jadi tidak ditambah.
