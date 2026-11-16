import { generatePayslipPdf, formatPayslipFilename, type PayslipData } from '@/lib/payroll-pdf'

const mockEntry: PayslipData = {
  tutor: { name: 'Budi Santoso' },
  periodMonth: '2026-11',
  hariKerja: 20,
  dailyRateAmount: 1_000_000,
  izinHari: 1,
  bonusOntimeDays: 18,
  bonusOntimeAmount: 180_000,
  extraTimeHours: 5,
  extraTimeAmount: 100_000,
  extraHandleCount: 3,
  extraHandleAmount: 90_000,
  totalAmount: 1_370_000,
  status: 'DRAFT',
  generatedAt: new Date('2026-11-30T10:00:00Z'),
}

describe('generatePayslipPdf', () => {
  it('returns a non-empty ArrayBuffer starting with the PDF magic bytes', async () => {
    const buf = await generatePayslipPdf(mockEntry)
    expect(buf).toBeInstanceOf(ArrayBuffer)
    expect(buf.byteLength).toBeGreaterThan(500)
    expect(Buffer.from(buf).slice(0, 4).toString('ascii')).toBe('%PDF')
  })

  it('includes the tutor name and period in the document text', async () => {
    const text = Buffer.from(await generatePayslipPdf(mockEntry)).toString('latin1')
    expect(text).toContain('Budi Santoso')
    expect(text).toContain('November 2026')
    expect(text).toContain('(SLIP GAJI) Tj')
  })

  it('works for a finalized entry too', async () => {
    const buf = await generatePayslipPdf({ ...mockEntry, status: 'FINALIZED' })
    expect(Buffer.from(buf).slice(0, 4).toString('ascii')).toBe('%PDF')
  })
})

describe('formatPayslipFilename', () => {
  it('slugifies the tutor name and keeps the period month', () => {
    expect(formatPayslipFilename(mockEntry)).toBe('SLIP_GAJI_Budi_Santoso_2026-11')
  })
})
