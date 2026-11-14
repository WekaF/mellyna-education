import { calculatePayrollAmounts, periodMonthRangeWIB, isValidPeriodMonth } from '@/lib/payroll'

describe('calculatePayrollAmounts', () => {
  const rate = { dailyRate: 50000, onTimeBonusRate: 10000, overtimeRatePerHour: 20000, extraHandleRate: 30000 }

  it('sums each component from the rate and the counts', () => {
    const result = calculatePayrollAmounts(rate, {
      hariKerja: 20,
      bonusOntimeDays: 18,
      izinHari: 1,
      extraTimeHours: 5,
      extraHandleCount: 3,
    })
    expect(result).toEqual({
      dailyRateAmount: 1_000_000, // 20 * 50000
      bonusOntimeAmount: 180_000, // 18 * 10000
      extraTimeAmount: 100_000, // 5 * 20000
      extraHandleAmount: 90_000, // 3 * 30000
      totalAmount: 1_370_000,
    })
  })

  it('rounds fractional overtime amounts to the nearest rupiah', () => {
    const result = calculatePayrollAmounts(rate, {
      hariKerja: 0,
      bonusOntimeDays: 0,
      izinHari: 0,
      extraTimeHours: 1.5,
      extraHandleCount: 0,
    })
    expect(result.extraTimeAmount).toBe(30_000)
  })

  it('is zero everywhere when there are no counts', () => {
    const result = calculatePayrollAmounts(rate, {
      hariKerja: 0,
      bonusOntimeDays: 0,
      izinHari: 0,
      extraTimeHours: 0,
      extraHandleCount: 0,
    })
    expect(result.totalAmount).toBe(0)
  })
})

describe('isValidPeriodMonth', () => {
  it.each(['2026-01', '2026-11', '2026-12'])('accepts %s', (value) => {
    expect(isValidPeriodMonth(value)).toBe(true)
  })

  it.each(['2026-13', '2026-00', '2026-1', '26-11', 'abc', ''])('rejects %s', (value) => {
    expect(isValidPeriodMonth(value)).toBe(false)
  })
})

describe('periodMonthRangeWIB', () => {
  it('spans the full WIB calendar month', () => {
    const { start, end } = periodMonthRangeWIB('2026-11')
    expect(start.toISOString()).toBe('2026-10-31T17:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-30T16:59:59.999Z')
  })

  it('wraps december into the next year', () => {
    const { start, end } = periodMonthRangeWIB('2026-12')
    expect(start.toISOString()).toBe('2026-11-30T17:00:00.000Z')
    expect(end.toISOString()).toBe('2026-12-31T16:59:59.999Z')
  })

  it('handles a leap-year february correctly', () => {
    const { end } = periodMonthRangeWIB('2028-02')
    expect(end.toISOString()).toBe('2028-02-29T16:59:59.999Z')
  })

  it('handles a non-leap-year february correctly', () => {
    const { end } = periodMonthRangeWIB('2026-02')
    expect(end.toISOString()).toBe('2026-02-28T16:59:59.999Z')
  })
})
