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
