# Invoice WA Caption (Lunas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Saat admin klik "Kirim WA" di menu Invoice untuk invoice berstatus `PAID`, caption WA ke orang tua berbunyi "Berikut kami lampirkan invoice untuk <siswa>" (bukan "invoice tagihan"), dengan status LUNAS + tanggal bayar menggantikan jatuh tempo. Invoice non-PAID tetap pakai caption lama.

**Architecture:** Caption saat ini dirakit inline di `app/api/invoices/[id]/send-wa/route.ts`. Pindahkan ke fungsi murni `buildInvoiceWaCaption` di `lib/invoice-pdf.ts` (tempat helper invoice lain seperti `formatInvoiceFilename`), bercabang berdasarkan `status`. Route cukup memanggil fungsi itu. Fungsi murni = bisa dites tanpa mock Prisma/WAHA. (Route file Next.js tidak boleh export selain handler, jadi helper wajib di `lib/`.)

**Tech Stack:** Next.js App Router, TypeScript, Jest (`npm test`, `testEnvironment: node`, alias `@/`).

**Asumsi (veto kalau salah):** redaksi persis di bawah adalah usulan — kalau user mau teks lain, cukup ubah string di Task 1 Step 3 + ekspektasi test.

---

## File Structure

- Modify: `lib/invoice-pdf.ts` — tambah `buildInvoiceWaCaption` (export).
- Modify: `app/api/invoices/[id]/send-wa/route.ts:58-65` — ganti caption inline dengan panggilan `buildInvoiceWaCaption`.
- Test: `__tests__/lib/invoice-wa-caption.test.ts` (baru).

---

### Task 1: Fungsi `buildInvoiceWaCaption`

**Files:**
- Modify: `lib/invoice-pdf.ts`
- Test: `__tests__/lib/invoice-wa-caption.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

Create `__tests__/lib/invoice-wa-caption.test.ts`:

```ts
import { buildInvoiceWaCaption } from '@/lib/invoice-pdf'

const base = {
  parentName: 'Bapak Fauzi',
  studentName: 'Ahmad Fauzi',
  invNo: 'INV-202606-456789',
  description: 'Biaya Kursus Sempoa Bulan Juni 2026',
  amount: 350000,
  dueDate: new Date('2026-06-30T00:00:00+07:00'),
  paidAt: null as Date | null,
}

describe('buildInvoiceWaCaption', () => {
  it('PAID: redaksi "invoice untuk siswa", status LUNAS, tanggal bayar, tanpa jatuh tempo', () => {
    const c = buildInvoiceWaCaption({ ...base, status: 'PAID', paidAt: new Date('2026-06-10T10:00:00+07:00') })
    expect(c).toContain('Halo Bapak Fauzi,')
    expect(c).toContain('Berikut kami lampirkan invoice untuk Ahmad Fauzi.')
    expect(c).toContain('Status      : LUNAS')
    expect(c).toContain('Tgl. Bayar  : 10 Juni 2026')
    expect(c).not.toContain('tagihan')
    expect(c).not.toContain('Jatuh Tempo')
  })

  it('PAID tanpa paidAt: baris tanggal bayar dihilangkan', () => {
    const c = buildInvoiceWaCaption({ ...base, status: 'PAID' })
    expect(c).toContain('Status      : LUNAS')
    expect(c).not.toContain('Tgl. Bayar')
  })

  it('PENDING: caption lama tidak berubah', () => {
    const c = buildInvoiceWaCaption({ ...base, status: 'PENDING' })
    expect(c).toBe(
      'Halo Bapak Fauzi,\n\n' +
      'Berikut kami lampirkan invoice tagihan bimbingan belajar untuk Ahmad Fauzi.\n\n' +
      'No. Invoice : INV-202606-456789\n' +
      'Keterangan  : Biaya Kursus Sempoa Bulan Juni 2026\n' +
      `Nominal     : ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(350000)}\n` +
      'Jatuh Tempo : 30 Juni 2026\n\n' +
      'Terima kasih,\nMellyna Education'
    )
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `rtk npx jest __tests__/lib/invoice-wa-caption.test.ts`
Expected: FAIL — `buildInvoiceWaCaption is not a function` / TS export not found.

- [ ] **Step 3: Implementasi minimal**

Di `lib/invoice-pdf.ts`, tambah `import { formatRupiah } from '@/lib/utils'` setelah `import path from 'path'` (baris 3; belum di-import), lalu tambahkan fungsi ini tepat setelah `formatInvoiceFilename`:

```ts
const fmtDateId = (d: Date) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(d)

export function buildInvoiceWaCaption(p: {
  parentName: string
  studentName: string
  invNo: string
  description: string
  amount: number
  dueDate: Date
  status: string
  paidAt: Date | null
}): string {
  const detail =
    `No. Invoice : ${p.invNo}\n` +
    `Keterangan  : ${p.description}\n` +
    `Nominal     : ${formatRupiah(p.amount)}\n`

  if (p.status === 'PAID') {
    return (
      `Halo ${p.parentName},\n\n` +
      `Berikut kami lampirkan invoice untuk ${p.studentName}.\n\n` +
      detail +
      `Status      : LUNAS\n` +
      (p.paidAt ? `Tgl. Bayar  : ${fmtDateId(p.paidAt)}\n` : '') +
      `\nTerima kasih,\nMellyna Education`
    )
  }

  return (
    `Halo ${p.parentName},\n\n` +
    `Berikut kami lampirkan invoice tagihan bimbingan belajar untuk ${p.studentName}.\n\n` +
    detail +
    `Jatuh Tempo : ${fmtDateId(p.dueDate)}\n\n` +
    `Terima kasih,\nMellyna Education`
  )
}
```

Catatan: `timeZone: 'Asia/Jakarta'` ditambah supaya tanggal tidak geser saat server jalan di UTC (route lama tidak set timezone; jatuh tempo yang disimpan tengah malam WIB bisa tampil H-1 di server UTC). Kalau ini mengubah output jatuh tempo yang dianggap benar di prod, hapus `timeZone` dan sesuaikan test.

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run: `rtk npx jest __tests__/lib/invoice-wa-caption.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 6: Commit**

```bash
rtk git add lib/invoice-pdf.ts __tests__/lib/invoice-wa-caption.test.ts
rtk git commit -m "feat(invoice): caption WA khusus invoice lunas"
```

---

### Task 2: Pakai `buildInvoiceWaCaption` di route send-wa

**Files:**
- Modify: `app/api/invoices/[id]/send-wa/route.ts`

- [ ] **Step 1: Ganti import**

```ts
import { generateInvoicePdf, formatInvoiceFilename, buildInvoiceWaCaption } from '@/lib/invoice-pdf'
import { sendWhatsAppFile, sendWhatsApp } from '@/lib/waha'
```

Hapus `import { formatRupiah } from '@/lib/utils'` (tidak dipakai lagi di route).

- [ ] **Step 2: Ganti blok caption inline (`const caption = ...` sampai `Mellyna Education\``) dengan:**

```ts
    const caption = buildInvoiceWaCaption({
      parentName: parent.name,
      studentName: invoice.student.name,
      invNo,
      description: invoice.description,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      status: invoice.status,
      paidAt: invoice.paidAt,
    })
```

Fallback text-only (`sendWhatsApp(phone, caption)`) otomatis ikut caption baru — tidak perlu diubah.

- [ ] **Step 3: Typecheck + full test**

Run: `rtk tsc --noEmit`
Expected: no errors.

Run: `rtk npm test`
Expected: semua PASS (termasuk `invoice-pdf.test.ts` existing).

- [ ] **Step 4: Verifikasi manual**

`rtk npm run dev` → login admin → Billing/Invoice → pilih invoice LUNAS → "Kirim WA" ke nomor tes. Cek caption: "Berikut kami lampirkan invoice untuk <siswa>.", ada "Status : LUNAS" + "Tgl. Bayar", tidak ada "Jatuh Tempo". Ulangi untuk invoice PENDING → caption lama.

- [ ] **Step 5: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 6: Commit**

```bash
rtk git add "app/api/invoices/[id]/send-wa/route.ts"
rtk git commit -m "refactor(invoice): send-wa pakai buildInvoiceWaCaption"
```
