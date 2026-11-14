import { prisma } from '@/lib/db'
import { isLateDailyCheckIn, scheduleDayWIB } from '@/lib/checkin-policy'

export type PayrollRate = {
  dailyRate: number
  onTimeBonusRate: number
  overtimeRatePerHour: number
  extraHandleRate: number
}

export type PayrollCounts = {
  hariKerja: number
  bonusOntimeDays: number
  izinHari: number
  extraTimeHours: number
  extraHandleCount: number
}

export type PayrollAmounts = {
  dailyRateAmount: number
  bonusOntimeAmount: number
  extraTimeAmount: number
  extraHandleAmount: number
  totalAmount: number
}

export function calculatePayrollAmounts(rate: PayrollRate, counts: PayrollCounts): PayrollAmounts {
  const dailyRateAmount = counts.hariKerja * rate.dailyRate
  const bonusOntimeAmount = counts.bonusOntimeDays * rate.onTimeBonusRate
  const extraTimeAmount = Math.round(counts.extraTimeHours * rate.overtimeRatePerHour)
  const extraHandleAmount = counts.extraHandleCount * rate.extraHandleRate
  return {
    dailyRateAmount,
    bonusOntimeAmount,
    extraTimeAmount,
    extraHandleAmount,
    totalAmount: dailyRateAmount + bonusOntimeAmount + extraTimeAmount + extraHandleAmount,
  }
}

export function isValidPeriodMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

// Rentang WIB penuh buat satu bulan periode payroll ("YYYY-MM"), robust terhadap panjang bulan/tahun kabisat.
export function periodMonthRangeWIB(periodMonth: string): { start: Date; end: Date } {
  const [yStr, mStr] = periodMonth.split('-')
  const y = Number(yStr)
  const m = Number(mStr)
  const start = new Date(`${periodMonth}-01T00:00:00+07:00`)
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  const nextMonthStart = new Date(`${nextY}-${String(nextM).padStart(2, '0')}-01T00:00:00+07:00`)
  const end = new Date(nextMonthStart.getTime() - 1)
  return { start, end }
}

// Kumpulkan angka mentah payroll sebulan dari absen harian, izin, jadwal extra-handle, dan lembur manual.
export async function gatherPayrollCounts(tutorId: string, periodMonth: string): Promise<PayrollCounts> {
  const { start, end } = periodMonthRangeWIB(periodMonth)

  const [dailyCheckIns, approvedLeaves, extraHandleSchedules, overtime] = await Promise.all([
    prisma.tutorCheckIn.findMany({
      where: { tutorId, scheduleId: null, isWithinRadius: true, checkedInAt: { gte: start, lte: end } },
      select: { date: true, checkedInAt: true },
    }),
    prisma.tutorLeaveRequest.findMany({
      where: { tutorId, status: 'APPROVED', date: { gte: start, lte: end } },
      select: { id: true },
    }),
    prisma.schedule.findMany({
      where: {
        date: { gte: start, lte: end },
        status: { in: ['PUBLISHED', 'COMPLETED'] },
        class: { additionalTutors: { some: { tutorId } } },
      },
      select: { id: true, date: true },
    }),
    prisma.tutorOvertimeEntry.aggregate({
      where: { tutorId, date: { gte: start, lte: end } },
      _sum: { hours: true },
    }),
  ])

  const attendedDates = new Set(dailyCheckIns.map((c) => c.date))
  // Extra handle cuma dihitung kalau tutor memang absen hari itu (absen harian menutup semua jadwal hari itu).
  const extraHandleCount = extraHandleSchedules.filter((s) => attendedDates.has(scheduleDayWIB(s.date))).length

  return {
    hariKerja: dailyCheckIns.length,
    bonusOntimeDays: dailyCheckIns.filter((c) => !isLateDailyCheckIn(c.date, c.checkedInAt)).length,
    izinHari: approvedLeaves.length,
    extraTimeHours: overtime._sum.hours ?? 0,
    extraHandleCount,
  }
}
