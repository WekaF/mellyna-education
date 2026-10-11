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
