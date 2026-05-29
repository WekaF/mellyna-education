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

  it('handles null phone and grade gracefully', async () => {
    const invoiceNoOptionals: InvoiceData = {
      ...mockInvoice,
      student: {
        name: 'Anak Tanpa Grade',
        grade: null,
        parent: { name: 'Orang Tua', phone: null, email: 'test@example.com' },
      },
    }
    const result = await generateInvoicePdf(invoiceNoOptionals)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.toString('ascii', 0, 4)).toBe('%PDF')
  })

  it('handles PAID status badge', async () => {
    const paidInvoice: InvoiceData = { ...mockInvoice, status: 'PAID' }
    const result = await generateInvoicePdf(paidInvoice)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(1000)
  })
})
