# Kwitansi untuk Invoice Lunas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dokumen untuk pembayaran yang sudah lunas (`status === 'PAID'`) disebut **kwitansi** di semua tempat (teks WA, isi PDF, nama file, tampilan Billing); yang belum lunas tetap **invoice** tanpa perubahan.

**Architecture:** Satu aturan saja: `status === 'PAID'` → kwitansi. Aturan itu diterapkan di tiga fungsi yang sudah ada di `lib/invoice-pdf.ts` (`formatInvoiceFilename`, `buildInvoiceWaCaption`, `generateInvoicePdf`), sehingga route download PDF, route kirim WA manual, dan webhook Midtrans ikut berubah lewat fungsi bersama, bukan lewat teks yang ditulis ulang di tiap route. Tidak ada tabel, kolom, atau penomoran baru: nomor dokumen tetap `INV-YYYYMM-XXXXXX` dengan label "No. Invoice" sebagai nomor rujukan.

**Tech Stack:** Next.js App Router, TypeScript, jsPDF, Jest (`testEnvironment: node`, alias `@/`).

**Catatan lingkungan:**
- Folder repo ini dipakai beberapa sesi sekaligus dan branch aktifnya sering berpindah. Kerjakan di worktree terpisah (skill `superpowers:using-git-worktrees`), branch `feat/kwitansi-lunas` dari `main`. Jangan commit di folder repo utama.
- Perintah ditulis dengan awalan `rtk` sesuai aturan user. Kalau muncul `rtk: command not found`, jalankan perintah yang sama tanpa `rtk`.
- Jest juga menemukan salinan test di `.claude/worktrees/`; karena itu semua perintah jest di bawah memakai `--testPathIgnorePatterns "\.claude"`.
- jsPDF menulis teks apa adanya ke dalam PDF (tanpa kompresi), jadi isi PDF bisa dites dengan mencari `(TEKS) Tj` di dalam buffer. Sudah dicek di repo ini.

---

## File Structure

- Modify: `lib/invoice-pdf.ts` — `formatInvoiceFilename` (awalan nama file), `buildInvoiceWaCaption` (teks WA), `generateInvoicePdf` (label di PDF).
- Modify: `app/api/invoices/[id]/send-wa/route.ts` — tambah `docName` di respons.
- Modify: `app/api/webhooks/midtrans/route.ts` — `sendPaidReceipt`: buang awalan `KWITANSI_` manual supaya tidak dobel.
- Modify: `app/(dashboard)/admin/billing/BillingClient.tsx` — `handleSendWA` dan tooltip tombol WA.
- Test: `__tests__/lib/invoice-pdf.test.ts`, `__tests__/lib/invoice-wa-caption.test.ts`.
- Tidak diubah: `app/api/invoices/[id]/pdf/route.ts` (sudah mengoper objek invoice lengkap berisi `status` ke `formatInvoiceFilename`, jadi nama file download ikut berubah sendiri).

---

### Task 1: Nama file berawalan `KWITANSI_` saat lunas

**Files:**
- Modify: `lib/invoice-pdf.ts` (fungsi `formatInvoiceFilename`)
- Modify: `app/api/webhooks/midtrans/route.ts` (fungsi `sendPaidReceipt`)
- Test: `__tests__/lib/invoice-pdf.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

Di `__tests__/lib/invoice-pdf.test.ts`, ganti baris import pertama menjadi:

```ts
import { generateInvoicePdf, formatInvoiceFilename, InvoiceData } from '@/lib/invoice-pdf'
```

Lalu tambahkan di akhir file:

```ts
describe('formatInvoiceFilename', () => {
  const inv = {
    createdAt: new Date(2026, 5, 1),
    description: 'Biaya Kursus Sempoa Bulan Juni 2026',
    student: { name: 'Ahmad Fauzi', parent: { name: 'Bapak Fauzi' } },
  }

  it('PAID: awalan KWITANSI_', () => {
    expect(formatInvoiceFilename({ ...inv, status: 'PAID' }))
      .toBe('KWITANSI_Bapak_Fauzi(Ahmad)_Biaya_Kursus_Sempoa_Bulan_01062026')
  })

  it('belum lunas atau tanpa status: awalan INV_ seperti semula', () => {
    const expected = 'INV_Bapak_Fauzi(Ahmad)_Biaya_Kursus_Sempoa_Bulan_01062026'
    expect(formatInvoiceFilename({ ...inv, status: 'PENDING' })).toBe(expected)
    expect(formatInvoiceFilename({ ...inv, status: 'OVERDUE' })).toBe(expected)
    expect(formatInvoiceFilename(inv)).toBe(expected)
  })
})
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `rtk npx jest __tests__/lib/invoice-pdf.test.ts --testPathIgnorePatterns "\.claude"`
Expected: FAIL di test `PAID: awalan KWITANSI_` (hasil masih `INV_...`). Test kedua PASS. (Jest di repo ini tidak memeriksa tipe, jadi kegagalannya murni dari nilai.)

- [ ] **Step 3: Implementasi**

Di `lib/invoice-pdf.ts`, ganti seluruh fungsi `formatInvoiceFilename` dengan:

```ts
export function formatInvoiceFilename(invoice: {
  createdAt: Date
  description: string
  status?: string
  student: { name: string; parent: { name: string } | null }
}): string {
  const parentName = slug(invoice.student.parent?.name ?? 'unknown', 20)
  const studentFirst = slug((invoice.student.name ?? '').split(' ')[0], 15)
  const desc = slug(invoice.description, 25)
  const d = invoice.createdAt
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const prefix = invoice.status === 'PAID' ? 'KWITANSI' : 'INV'
  return `${prefix}_${parentName}(${studentFirst})_${desc}_${dd}${mm}${yyyy}`
}
```

- [ ] **Step 4: Betulkan webhook Midtrans supaya awalan tidak dobel**

Di `app/api/webhooks/midtrans/route.ts`, dalam `sendPaidReceipt`, ganti baris:

```ts
    const filename = `KWITANSI_${formatInvoiceFilename(inv)}.pdf`
```

menjadi:

```ts
    const filename = `${formatInvoiceFilename({ ...inv, status: 'PAID' })}.pdf`
```

`status: 'PAID'` ditulis eksplisit karena fungsi ini memang hanya jalan setelah pembayaran sukses (sama seperti pemanggilan `generateInvoicePdf` beberapa baris di atasnya). Nama file WA otomatis berubah dari `KWITANSI_INV_...pdf` menjadi `KWITANSI_...pdf`.

- [ ] **Step 5: Jalankan, pastikan lolos**

Run: `rtk npx jest __tests__/lib/invoice-pdf.test.ts --testPathIgnorePatterns "\.claude"`
Expected: PASS (5 tests).

Run: `rtk npx tsc --noEmit`
Expected: tanpa error.

- [ ] **Step 6: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 7: Commit**

```bash
rtk git add lib/invoice-pdf.ts app/api/webhooks/midtrans/route.ts __tests__/lib/invoice-pdf.test.ts
rtk git commit -m "feat(invoice): nama file KWITANSI_ untuk invoice lunas"
```

---

### Task 2: Teks WA manual menyebut kwitansi saat lunas

**Files:**
- Modify: `lib/invoice-pdf.ts` (fungsi `buildInvoiceWaCaption`)
- Test: `__tests__/lib/invoice-wa-caption.test.ts`

- [ ] **Step 1: Ubah test supaya menuntut redaksi baru**

Di `__tests__/lib/invoice-wa-caption.test.ts`, ganti test pertama (yang judulnya diawali `PAID: redaksi "invoice untuk siswa"`) seluruhnya dengan:

```ts
  it('PAID: redaksi kwitansi, status LUNAS, tanggal bayar, tanpa jatuh tempo', () => {
    const c = buildInvoiceWaCaption({ ...base, status: 'PAID', paidAt: new Date('2026-06-10T10:00:00+07:00') })
    expect(c).toBe(
      'Halo Bapak Fauzi,\n\n' +
      'Berikut kami lampirkan kwitansi pembayaran untuk Ahmad Fauzi.\n\n' +
      'No. Invoice : INV-202606-456789\n' +
      'Keterangan  : Biaya Kursus Sempoa Bulan Juni 2026\n' +
      `Nominal     : ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(350000)}\n` +
      'Status      : LUNAS\n' +
      'Tgl. Bayar  : 10 Juni 2026\n\n' +
      'Terima kasih,\nMellyna Education'
    )
    expect(c).not.toContain('tagihan')
    expect(c).not.toContain('Jatuh Tempo')
  })
```

Dua test lain di file itu (`PAID tanpa paidAt` dan `PENDING: caption lama tidak berubah`) jangan diubah.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `rtk npx jest __tests__/lib/invoice-wa-caption.test.ts --testPathIgnorePatterns "\.claude"`
Expected: FAIL di test PAID; diff menunjukkan `invoice untuk Ahmad Fauzi` padahal diharapkan `kwitansi pembayaran untuk Ahmad Fauzi`.

- [ ] **Step 3: Implementasi**

Di `lib/invoice-pdf.ts`, dalam `buildInvoiceWaCaption`, cabang `if (p.status === 'PAID')`, ganti baris:

```ts
      `Berikut kami lampirkan invoice untuk ${p.studentName}.\n\n` +
```

menjadi:

```ts
      `Berikut kami lampirkan kwitansi pembayaran untuk ${p.studentName}.\n\n` +
```

Baris lain di fungsi itu tidak berubah. Label `No. Invoice` sengaja dipertahankan: nomornya memang nomor invoice yang dilunasi.

- [ ] **Step 4: Jalankan, pastikan lolos**

Run: `rtk npx jest __tests__/lib/invoice-wa-caption.test.ts --testPathIgnorePatterns "\.claude"`
Expected: PASS (3 tests).

- [ ] **Step 5: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 6: Commit**

```bash
rtk git add lib/invoice-pdf.ts __tests__/lib/invoice-wa-caption.test.ts
rtk git commit -m "feat(invoice): teks WA menyebut kwitansi untuk invoice lunas"
```

---

### Task 3: Isi PDF menjadi kwitansi saat lunas

**Files:**
- Modify: `lib/invoice-pdf.ts` (fungsi `generateInvoicePdf`)
- Test: `__tests__/lib/invoice-pdf.test.ts`

Perubahan label, hanya saat `status === 'PAID'`:

| Bagian PDF | Belum lunas (tetap) | Lunas (baru) |
|---|---|---|
| Judul di header | `INVOICE` | `KWITANSI` |
| Label kiri | `TAGIHAN KEPADA` | `DITERIMA DARI` |
| Judul kotak detail | `DETAIL INVOICE` | `DETAIL KWITANSI` |
| Baris `Jatuh Tempo` | ada | dihilangkan |
| Judul catatan bawah | `CARA PEMBAYARAN` | `PEMBAYARAN DITERIMA` |
| Isi catatan bawah | cara bayar via Midtrans/transfer | ucapan terima kasih, simpan sebagai bukti |

- [ ] **Step 1: Tulis test yang gagal**

Di `__tests__/lib/invoice-pdf.test.ts`, tambahkan di akhir file:

```ts
describe('generateInvoicePdf: kwitansi vs invoice', () => {
  const pdfText = async (inv: InvoiceData) => Buffer.from(await generateInvoicePdf(inv)).toString('latin1')

  it('PAID: berjudul KWITANSI, tanpa istilah tagihan', async () => {
    const s = await pdfText(mockInvoice)
    expect(s).toContain('(KWITANSI) Tj')
    expect(s).toContain('(DITERIMA DARI) Tj')
    expect(s).toContain('(DETAIL KWITANSI) Tj')
    expect(s).toContain('(PEMBAYARAN DITERIMA) Tj')
    expect(s).toContain('(Tgl. Bayar) Tj')
    expect(s).not.toContain('(INVOICE) Tj')
    expect(s).not.toContain('(TAGIHAN KEPADA) Tj')
    expect(s).not.toContain('(Jatuh Tempo) Tj')
    expect(s).not.toContain('(CARA PEMBAYARAN) Tj')
  })

  it('PENDING: tetap INVOICE seperti semula', async () => {
    const s = await pdfText({ ...mockInvoice, status: 'PENDING', paidAt: null })
    expect(s).toContain('(INVOICE) Tj')
    expect(s).toContain('(TAGIHAN KEPADA) Tj')
    expect(s).toContain('(DETAIL INVOICE) Tj')
    expect(s).toContain('(Jatuh Tempo) Tj')
    expect(s).toContain('(CARA PEMBAYARAN) Tj')
    expect(s).not.toContain('(KWITANSI) Tj')
  })
})
```

(`mockInvoice` di file itu sudah berstatus `PAID` dengan `paidAt` terisi.)

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `rtk npx jest __tests__/lib/invoice-pdf.test.ts --testPathIgnorePatterns "\.claude"`
Expected: test `PAID: berjudul KWITANSI` FAIL (PDF masih berisi `(INVOICE) Tj`); test `PENDING` PASS.

- [ ] **Step 3: Implementasi — penanda lunas**

Di `lib/invoice-pdf.ts`, dalam `generateInvoicePdf`, tepat setelah baris `const invNo = invoiceNumber(invoice)`, tambahkan:

```ts
  const isReceipt = invoice.status === 'PAID'
```

- [ ] **Step 4: Implementasi — judul header**

Ganti:

```ts
  doc.text('INVOICE', R, 38, { align: 'right' })
```

menjadi:

```ts
  doc.text(isReceipt ? 'KWITANSI' : 'INVOICE', R, 38, { align: 'right' })
```

- [ ] **Step 5: Implementasi — label kiri**

Ganti:

```ts
  doc.text('TAGIHAN KEPADA', P, metaY + 8)
```

menjadi:

```ts
  doc.text(isReceipt ? 'DITERIMA DARI' : 'TAGIHAN KEPADA', P, metaY + 8)
```

- [ ] **Step 6: Implementasi — kotak detail**

Ganti blok ini:

```ts
  doc.text('DETAIL INVOICE', boxX + 12, metaY + 20)

  const detailRows: [string, string][] = [
    ['No. Invoice', invNo],
    ['Tanggal', formatDate(invoice.createdAt)],
    ['Jatuh Tempo', formatDate(invoice.dueDate)],
  ]
  if (invoice.paidAt) detailRows.push(['Tgl. Bayar', formatDate(invoice.paidAt)])
```

menjadi:

```ts
  doc.text(isReceipt ? 'DETAIL KWITANSI' : 'DETAIL INVOICE', boxX + 12, metaY + 20)

  const detailRows: [string, string][] = [
    ['No. Invoice', invNo],
    ['Tanggal', formatDate(invoice.createdAt)],
  ]
  if (!isReceipt) detailRows.push(['Jatuh Tempo', formatDate(invoice.dueDate)])
  if (invoice.paidAt) detailRows.push(['Tgl. Bayar', formatDate(invoice.paidAt)])
```

- [ ] **Step 7: Implementasi — catatan bawah**

Ganti blok ini:

```ts
  doc.text('CARA PEMBAYARAN', P, noteY + 20)
  doc.setFont('helvetica', 'normal')
  const noteText =
    'Pembayaran dapat dilakukan melalui portal Mellyna Education (Midtrans) atau transfer bank. ' +
    'Hubungi admin untuk konfirmasi atau pertanyaan lebih lanjut.'
```

menjadi:

```ts
  doc.text(isReceipt ? 'PEMBAYARAN DITERIMA' : 'CARA PEMBAYARAN', P, noteY + 20)
  doc.setFont('helvetica', 'normal')
  const noteText = isReceipt
    ? 'Pembayaran telah kami terima. Terima kasih telah mempercayakan pendidikan anak kepada Mellyna Education. ' +
      'Simpan kwitansi ini sebagai bukti pembayaran.'
    : 'Pembayaran dapat dilakukan melalui portal Mellyna Education (Midtrans) atau transfer bank. ' +
      'Hubungi admin untuk konfirmasi atau pertanyaan lebih lanjut.'
```

Dua baris sesudahnya (`const noteLines = ...` dan `doc.text(noteLines, ...)`) tidak berubah.

- [ ] **Step 8: Jalankan, pastikan lolos**

Run: `rtk npx jest __tests__/lib/invoice-pdf.test.ts --testPathIgnorePatterns "\.claude"`
Expected: PASS (7 tests).

- [ ] **Step 9: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 10: Commit**

```bash
rtk git add lib/invoice-pdf.ts __tests__/lib/invoice-pdf.test.ts
rtk git commit -m "feat(invoice): PDF berjudul KWITANSI untuk invoice lunas"
```

---

### Task 4: Tampilan Billing menyebut kwitansi

**Files:**
- Modify: `app/api/invoices/[id]/send-wa/route.ts` (handler `POST`)
- Modify: `app/(dashboard)/admin/billing/BillingClient.tsx` (`handleSendWA`, tombol WA)

Tidak ada test otomatis untuk task ini: isinya dua string tampilan, dan repo ini tidak punya test komponen maupun test route yang me-mock Prisma. Diverifikasi lewat typecheck dan cek manual.

- [ ] **Step 1: Route kirim WA mengembalikan nama dokumen**

Di `app/api/invoices/[id]/send-wa/route.ts`, tepat setelah baris `const invNo = ...`, tambahkan:

```ts
    const docName = invoice.status === 'PAID' ? 'Kwitansi' : 'Invoice'
```

Lalu tambahkan `docName` ke kedua respons sukses. Respons fallback teks menjadi:

```ts
          return NextResponse.json({
            success: true,
            invoiceNo: invNo,
            sentTo: phone,
            docName,
            note: 'Terkirim sebagai pesan teks (lampiran PDF gagal dikirim via WhatDesks)',
          })
```

Respons sukses utama menjadi:

```ts
    return NextResponse.json({ success: true, invoiceNo: invNo, sentTo: phone, docName })
```

- [ ] **Step 2: Notifikasi di Billing**

Di `app/(dashboard)/admin/billing/BillingClient.tsx`, dalam `handleSendWA`, ganti:

```ts
      setWaFeedback({ id: invoiceId, ok: true, msg: `Invoice terkirim ke ${data.sentTo ?? 'penerima'}` })
```

menjadi:

```ts
      setWaFeedback({ id: invoiceId, ok: true, msg: `${data.docName ?? 'Invoice'} terkirim ke ${data.sentTo ?? 'penerima'}` })
```

- [ ] **Step 3: Tooltip tombol WA**

Di file yang sama, pada tombol dengan `onClick={() => handleSendWA(inv.id)}`, ganti:

```tsx
              title="Kirim Invoice via WhatsApp"
```

menjadi:

```tsx
              title={inv.status === 'PAID' ? 'Kirim Kwitansi via WhatsApp' : 'Kirim Invoice via WhatsApp'}
```

- [ ] **Step 4: Typecheck dan seluruh test**

Run: `rtk npx tsc --noEmit`
Expected: tanpa error.

Run: `rtk npx jest --testPathIgnorePatterns "\.claude"`
Expected: semua PASS.

- [ ] **Step 5: Cek manual**

`rtk npm run dev`, login admin, buka menu Billing:
1. Invoice LUNAS, tombol **PDF**: file terunduh bernama `KWITANSI_...pdf`, judulnya KWITANSI, ada "DITERIMA DARI" dan "Tgl. Bayar", tidak ada "Jatuh Tempo".
2. Invoice LUNAS, tombol **WA** (ke nomor tes): tooltip "Kirim Kwitansi via WhatsApp", notifikasi "Kwitansi terkirim ke …", pesan berbunyi "Berikut kami lampirkan kwitansi pembayaran untuk …".
3. Invoice BELUM LUNAS, tombol PDF dan WA: semuanya masih "Invoice" seperti sebelumnya, nama file `INV_...pdf`.

- [ ] **Step 6: Report ke user**

Lapor: file yang diedit/dibuat (path lengkap) + method/fungsi yang kena + ringkas perubahan (1-3 kalimat).

- [ ] **Step 7: Commit**

```bash
rtk git add "app/api/invoices/[id]/send-wa/route.ts" "app/(dashboard)/admin/billing/BillingClient.tsx"
rtk git commit -m "feat(billing): sebut kwitansi di tombol dan notifikasi WA invoice lunas"
```

---

## Di luar cakupan

- Teks WA otomatis Midtrans (`sendPaidReceipt`): sudah menyebut "Kwitansi terlampir", hanya nama filenya yang disesuaikan di Task 1.
- Nomor kwitansi tersendiri (mis. `KWT-...`): tidak dibuat; nomor invoice dipakai sebagai rujukan.
- Label menu, judul halaman Billing, dan portal orang tua: tetap "Invoice/Tagihan" karena menampilkan campuran lunas dan belum lunas.
