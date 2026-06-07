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
