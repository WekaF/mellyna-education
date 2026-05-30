# Payment System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lengkapi sistem pembayaran Midtrans Snap + tambah fitur manual payment (tunai/TF BRI offline) agar admin bisa mencatat semua metode pembayaran.

**Architecture:** Midtrans Snap sebagai gateway utama (BRI VA, GoPay, ShopeePay, QRIS, Alfamart). Untuk tunai/TF offline: admin input manual via endpoint baru `POST /api/payments/manual`. Webhook Midtrans sudah ada dan berfungsi.

**Tech Stack:** Next.js 15, Prisma (PostgreSQL), `midtrans-client` (Snap), NextAuth, Tailwind, React Hook Form / fetch

---

## Konteks Penting

Sebelum mulai, pahami yang sudah ada:

| File | Fungsi |
|------|--------|
| `lib/midtrans.ts` | Inisialisasi Snap client |
| `app/api/payments/create/route.ts` | Buat Snap transaction → return token |
| `app/api/webhooks/midtrans/route.ts` | Terima notifikasi dari Midtrans (signature verified) |
| `app/api/invoices/route.ts` | CRUD invoice |
| `app/api/invoices/[id]/route.ts` | Update/delete invoice (PUT support ubah status) |
| `app/(dashboard)/parent/billing/page.tsx` | UI parent — tombol "Bayar Sekarang" → `window.snap.pay()` |
| `app/(dashboard)/admin/billing/page.tsx` | UI admin — buat invoice, bulk invoice, remind WA |
| `app/layout.tsx` | Snap.js CDN sudah di-load via `<Script>` |
| `prisma/schema.prisma` | Model `Invoice` + `Payment` sudah lengkap |

**Midtrans Snap otomatis menampilkan:** BRI VA, BCA VA, Mandiri VA, GoPay, ShopeePay, QRIS, Alfamart, Indomaret, kartu kredit. Kita perlu filter agar hanya tampilkan metode relevan.

---

## File Structure

```
app/api/payments/
  create/route.ts          ← MODIFY: tambah enabled_payments filter
  manual/route.ts          ← CREATE: manual payment by admin

app/(dashboard)/admin/
  billing/page.tsx         ← MODIFY: tambah action per-invoice (manual pay, delete, cancel)

app/(dashboard)/parent/
  billing/page.tsx         ← MODIFY: tampilkan receipt/detail saat PAID
```

---

## Task 1: Filter Metode Pembayaran di Midtrans Snap

**Problem:** Saat ini Snap menampilkan semua metode termasuk kartu kredit, cicilan, dll yang tidak relevan untuk bimbel.
**Solution:** Tambah `enabled_payments` ke parameter Snap.

**Files:**
- Modify: `app/api/payments/create/route.ts`

- [ ] **Step 1: Baca file yang akan diubah**

```
Read: app/api/payments/create/route.ts
```

- [ ] **Step 2: Tambah `enabled_payments` ke parameter Snap**

Di `app/api/payments/create/route.ts`, ubah object `parameter` (sekitar baris 33):

```typescript
const parameter = {
  transaction_details: {
    order_id: orderId,
    gross_amount: invoice.amount,
  },
  customer_details: {
    first_name: invoice.student.parent.name,
    email: invoice.student.parent.email,
    phone: invoice.student.parent.phone || '',
  },
  item_details: [
    {
      id: invoice.id,
      price: invoice.amount,
      quantity: 1,
      name: invoice.description.substring(0, 50),
    },
  ],
  enabled_payments: [
    'bri_va',        // Transfer Bank BRI (Virtual Account)
    'gopay',         // GoPay
    'shopeepay',     // ShopeePay
    'qris',          // QRIS (universal semua e-wallet)
    'alfamart',      // Bayar tunai di Alfamart
    'indomaret',     // Bayar tunai di Indomaret
  ],
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/payments/create/route.ts
git commit -m "feat(payment): restrict Snap to BRI VA, GoPay, ShopeePay, QRIS, Alfamart"
```

---

## Task 2: API Manual Payment (Tunai / TF BRI Langsung)

**Problem:** Ketika parent bayar tunai di tempat atau TF ke rekening BRI asli, tidak ada cara untuk mencatatnya di sistem.
**Solution:** Endpoint baru `POST /api/payments/manual` — hanya SUPER_ADMIN, langsung mark invoice PAID + buat Payment record.

**Files:**
- Create: `app/api/payments/manual/route.ts`

- [ ] **Step 1: Buat file baru**

Buat `app/api/payments/manual/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const schema = z.object({
  invoiceId: z.string().min(1),
  method: z.enum(['CASH', 'BRI_TRANSFER', 'OTHER']),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { invoiceId, method, notes } = parsed.data

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return NextResponse.json({ error: 'Invoice tidak ditemukan.' }, { status: 404 })
  if (invoice.status === 'PAID') return NextResponse.json({ error: 'Invoice sudah lunas.' }, { status: 400 })

  const now = new Date()

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: now },
    }),
    prisma.payment.create({
      data: {
        invoiceId,
        amount: invoice.amount,
        method,
        status: 'SUCCESS',
        paidAt: now,
        midtransData: notes ? { notes } : undefined,
      },
    }),
  ])

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Tulis unit test**

Buat `__tests__/api/payments/manual.test.ts`:

```typescript
import { POST } from '@/app/api/payments/manual/route'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/db', () => ({ prisma: { invoice: { findUnique: jest.fn(), update: jest.fn() }, payment: { create: jest.fn() }, $transaction: jest.fn() } }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

const makeReq = (body: object) =>
  new NextRequest('http://localhost/api/payments/manual', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

describe('POST /api/payments/manual', () => {
  beforeEach(() => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'SUPER_ADMIN' } })
  })

  it('returns 401 when not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ invoiceId: 'x', method: 'CASH' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when role is PARENT', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { role: 'PARENT' } })
    const res = await POST(makeReq({ invoiceId: 'x', method: 'CASH' }))
    expect(res.status).toBe(403)
  })

  it('returns 404 when invoice not found', async () => {
    ;(prisma.invoice.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ invoiceId: 'notexist', method: 'CASH' }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when invoice already PAID', async () => {
    ;(prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ id: 'x', amount: 500000, status: 'PAID' })
    const res = await POST(makeReq({ invoiceId: 'x', method: 'CASH' }))
    expect(res.status).toBe(400)
  })

  it('marks invoice as PAID on success', async () => {
    ;(prisma.invoice.findUnique as jest.Mock).mockResolvedValue({ id: 'x', amount: 500000, status: 'PENDING' })
    ;(prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}])
    const res = await POST(makeReq({ invoiceId: 'x', method: 'CASH', notes: 'Bayar di tempat' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
```

- [ ] **Step 3: Run test**

```bash
pnpm test __tests__/api/payments/manual.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 4: Commit**

```bash
git add app/api/payments/manual/route.ts __tests__/api/payments/manual.test.ts
git commit -m "feat(payment): add manual payment API for cash/BRI offline"
```

---

## Task 3: Admin Billing UI — Aksi Per Invoice

**Problem:** Admin tidak bisa tandai lunas manual, hapus, atau cancel invoice dari UI.
**Solution:** Tambah kolom "Aksi" di tabel invoice dengan tombol: Tandai Lunas (untuk PENDING), Cancel, Hapus.

**Files:**
- Modify: `app/(dashboard)/admin/billing/page.tsx`

- [ ] **Step 1: Tambah interface dan state untuk modal manual payment**

Di `app/(dashboard)/admin/billing/page.tsx`, tambah state baru dan interface setelah state yang sudah ada:

```typescript
// Tambah ke interface Invoice yang sudah ada:
interface Invoice {
  id: string
  description: string
  amount: number
  dueDate: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  student: { name: string }
}

// Tambah state baru setelah state classList:
const [manualPayModal, setManualPayModal] = useState<{ invoiceId: string; studentName: string; amount: number } | null>(null)
const [manualMethod, setManualMethod] = useState<'CASH' | 'BRI_TRANSFER' | 'OTHER'>('CASH')
const [manualNotes, setManualNotes] = useState('')
const [manualSaving, setManualSaving] = useState(false)
```

- [ ] **Step 2: Tambah handler functions**

Tambah tiga fungsi setelah `handleBulkSubmit`:

```typescript
const handleManualPay = async () => {
  if (!manualPayModal) return
  setManualSaving(true)
  try {
    const res = await fetch('/api/payments/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: manualPayModal.invoiceId, method: manualMethod, notes: manualNotes }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Gagal mencatat pembayaran.')
    }
    setManualPayModal(null)
    setManualNotes('')
    await fetchInvoices()
  } catch (err: any) {
    setError(err.message)
  } finally {
    setManualSaving(false)
  }
}

const handleCancelInvoice = async (id: string) => {
  if (!confirm('Batalkan invoice ini?')) return
  try {
    const res = await fetch(`/api/invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    })
    if (!res.ok) throw new Error()
    await fetchInvoices()
  } catch {
    setError('Gagal membatalkan invoice.')
  }
}

const handleDeleteInvoice = async (id: string) => {
  if (!confirm('Hapus invoice ini permanen? Tindakan tidak bisa dibatalkan.')) return
  try {
    const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error()
    await fetchInvoices()
  } catch {
    setError('Gagal menghapus invoice.')
  }
}
```

- [ ] **Step 3: Tambah kolom Aksi ke tabel**

Di dalam `useMemo` columns, tambah kolom aksi setelah kolom status:

```typescript
{
  id: 'actions',
  header: 'Aksi',
  cell: ({ row }) => {
    const inv = row.original
    return (
      <div className="flex items-center gap-1">
        {inv.status === 'PENDING' && (
          <button
            onClick={() => setManualPayModal({ invoiceId: inv.id, studentName: inv.student.name, amount: inv.amount })}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
          >
            Tandai Lunas
          </button>
        )}
        {inv.status === 'PENDING' && (
          <button
            onClick={() => handleCancelInvoice(inv.id)}
            className="text-xs font-semibold text-amber-600 hover:text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
        {inv.status !== 'PAID' && (
          <button
            onClick={() => handleDeleteInvoice(inv.id)}
            className="text-xs font-semibold text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
          >
            Hapus
          </button>
        )}
      </div>
    )
  },
},
```

- [ ] **Step 4: Tambah modal Manual Payment**

Tambah JSX modal sebelum `<div className="rounded-2xl bg-white border border-slate-100 ...">` yang berisi DataTable:

```tsx
{manualPayModal && (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
      <h2 className="font-bold text-slate-800 mb-1">Tandai Lunas Manual</h2>
      <p className="text-sm text-slate-500 mb-4">
        {manualPayModal.studentName} — {formatRupiah(manualPayModal.amount)}
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Metode Pembayaran *</label>
          <select
            value={manualMethod}
            onChange={(e) => setManualMethod(e.target.value as typeof manualMethod)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 bg-white"
          >
            <option value="CASH">Tunai (Bayar Langsung)</option>
            <option value="BRI_TRANSFER">Transfer BRI (Manual)</option>
            <option value="OTHER">Lainnya</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Catatan (opsional)</label>
          <input
            type="text"
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
            placeholder="mis. Bayar tunai ke Bu Mellyna tgl 1 Juni"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleManualPay}
            disabled={manualSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 flex-1"
          >
            {manualSaving ? 'Menyimpan...' : 'Konfirmasi Lunas'}
          </button>
          <button
            onClick={() => { setManualPayModal(null); setManualNotes('') }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/admin/billing/page.tsx"
git commit -m "feat(billing): add manual payment modal and per-invoice actions in admin"
```

---

## Task 4: Parent Billing UI — Tampilkan Kwitansi / Detail Pembayaran

**Problem:** Setelah invoice PAID, parent tidak tahu kapan bayar dan metode apa.
**Solution:** Tampilkan "Lunas" dengan info tanggal dan metode di kartu invoice.

**Files:**
- Modify: `app/(dashboard)/parent/billing/page.tsx`

- [ ] **Step 1: Update interface Invoice untuk include paidAt dan payments**

```typescript
interface Invoice {
  id: string
  description: string
  amount: number
  dueDate: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  paidAt: string | null
  student: { name: string }
  payments: { method: string | null; paidAt: string | null }[]
}
```

- [ ] **Step 2: Update fetch API — cek apakah API invoices return payments**

Baca `app/api/invoices/route.ts` untuk verifikasi response shape termasuk `payments` dan `paidAt`. Jika belum, lanjut ke step 3.

- [ ] **Step 3: Cek & update invoices GET API**

Buka `app/api/invoices/route.ts`. Pastikan query `prisma.invoice.findMany` include `payments`:

```typescript
// Cari bagian include di findMany, pastikan ada:
include: {
  student: true,
  payments: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { method: true, paidAt: true },
  },
},
```

Jika belum ada `payments` di include, tambahkan.

- [ ] **Step 4: Tambah tampilan receipt di kartu invoice parent**

Di `app/(dashboard)/parent/billing/page.tsx`, di dalam `.map((inv) => ...)`, setelah baris yang menampilkan `Jatuh tempo`, tambah conditional receipt:

```tsx
{inv.status === 'PAID' && (
  <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
    <span>✅ Lunas</span>
    {inv.paidAt && (
      <span className="text-slate-400">
        — {new Date(inv.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
      </span>
    )}
    {inv.payments?.[0]?.method && (
      <span className="text-slate-400">
        via {
          inv.payments[0].method === 'CASH' ? 'Tunai' :
          inv.payments[0].method === 'BRI_TRANSFER' ? 'Transfer BRI' :
          inv.payments[0].method === 'gopay' ? 'GoPay' :
          inv.payments[0].method === 'shopeepay' ? 'ShopeePay' :
          inv.payments[0].method === 'bri_va' ? 'BRI Virtual Account' :
          inv.payments[0].method === 'qris' ? 'QRIS' :
          inv.payments[0].method
        }
      </span>
    )}
  </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/parent/billing/page.tsx" app/api/invoices/route.ts
git commit -m "feat(billing): show payment receipt with date and method for parent"
```

---

## Task 5: Verifikasi End-to-End

- [ ] **Step 1: Test Midtrans Sandbox**

Setup environment:
```
MIDTRANS_SERVER_KEY=SB-Mid-server-xxx (dari dashboard.sandbox.midtrans.com)
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false
```

Jalankan dev server:
```bash
pnpm dev
```

- [ ] **Step 2: Test flow online payment**

1. Login sebagai PARENT
2. Buka `/parent/billing`
3. Klik "Bayar Sekarang" pada invoice PENDING
4. Verifikasi popup Midtrans muncul dengan metode: BRI VA, GoPay, ShopeePay, QRIS, Alfamart
5. Bayar dengan test card/VA sandbox Midtrans
6. Verifikasi status invoice berubah jadi PAID setelah webhook

- [ ] **Step 3: Test manual payment**

1. Login sebagai SUPER_ADMIN
2. Buka `/admin/billing`
3. Klik "Tandai Lunas" pada invoice PENDING
4. Pilih metode "Tunai", isi catatan, klik "Konfirmasi Lunas"
5. Verifikasi invoice status berubah jadi PAID di tabel
6. Login sebagai PARENT, buka billing — verifikasi receipt tampil

- [ ] **Step 4: Test webhook (opsional, untuk production)**

```bash
# Gunakan Midtrans webhook simulator di dashboard sandbox
# atau ngrok untuk test lokal:
ngrok http 3000
# Set webhook URL di Midtrans: https://xxx.ngrok.io/api/webhooks/midtrans
```

- [ ] **Step 5: Run semua tests**

```bash
pnpm test
```

Expected: semua test PASS

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: payment system complete — Midtrans Snap + manual payment"
```

---

## Catatan Penting untuk Production

**Sebelum go-live:**
1. Daftar akun Midtrans production di `dashboard.midtrans.com` (bukan sandbox)
2. Ubah `.env`:
   ```
   MIDTRANS_SERVER_KEY=Mid-server-xxx (production key)
   MIDTRANS_CLIENT_KEY=Mid-client-xxx
   NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=true
   ```
3. Set webhook URL di dashboard Midtrans: `https://yourdomain.com/api/webhooks/midtrans`
4. BRI VA di production langsung ke rekening BRI bisnis Mellyna (dikonfigurasi di akun Midtrans)
5. Biaya Midtrans: ~0.7% untuk VA + flat fee untuk e-wallet (cek pricing terbaru di midtrans.com)

**Tentang TF ke rekening BRI langsung (bukan via Midtrans):**
- Tidak disarankan untuk flow utama — tidak ada auto-confirm, admin harus manual cek mutasi
- Gunakan fitur "Tandai Lunas Manual" (Task 3) untuk mencatat pembayaran ini
- Alternatif: setup BRI VA di Midtrans, parent TF ke nomor VA yang unik per invoice → auto-confirm

---

## Self-Review

**Spec coverage:**
- ✅ BRI transfer → BRI Virtual Account via Midtrans Snap (Task 1)
- ✅ GoPay → covered di enabled_payments (Task 1)
- ✅ ShopeePay → covered di enabled_payments (Task 1)
- ✅ Tunai → Alfamart/Indomaret via Snap + manual payment (Task 2, 3)
- ✅ Manual payment admin → Task 2 + Task 3
- ✅ Parent receipt → Task 4

**Placeholder scan:** Tidak ada TBD atau placeholder.

**Type consistency:**
- `manualMethod` type `'CASH' | 'BRI_TRANSFER' | 'OTHER'` konsisten antara Task 2 (API) dan Task 3 (UI)
- `Invoice.payments` interface di Task 4 match dengan API response
