import { generateInvoicePdf, formatInvoiceFilename, InvoiceData } from '@/lib/invoice-pdf'

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
  it('returns a non-empty ArrayBuffer', async () => {
    const buf = await generateInvoicePdf(mockInvoice)
    expect(buf).toBeInstanceOf(ArrayBuffer)
    expect(buf.byteLength).toBeGreaterThan(1000)
  })

  it('PDF starts with %PDF magic bytes', async () => {
    const buf = await generateInvoicePdf(mockInvoice)
    expect(Buffer.from(buf).slice(0, 4).toString('ascii')).toBe('%PDF')
  })

  it('works for all status values', async () => {
    const statuses: InvoiceData['status'][] = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']
    for (const status of statuses) {
      const buf = await generateInvoicePdf({ ...mockInvoice, status, paidAt: null })
      expect(Buffer.from(buf).slice(0, 4).toString('ascii')).toBe('%PDF')
    }
  })
})

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
