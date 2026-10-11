export const CHECKIN_OPENS_MINUTES_BEFORE = 30

// Jadwal dengan tanggal WIB sebelum ini bebas dari kunci laporan (belum ada absen per jadwal).
// Nilai awal = tanggal plan dibuat supaya kunci bisa dites lokal; diubah ke tanggal deploy di Task 10.
export const REPORT_GATE_FROM = '2026-10-11'

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

export type CheckInWindow = 'not-open' | 'open' | 'closed'
export type ReportAccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type ReportAccessReason = 'exempt' | 'checked-in' | 'approved' | 'no-checkin'

export function scheduleDayWIB(date: Date): string {
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10)
}

export function scheduleStartAt(date: Date, startTime: string): Date {
  const day = scheduleDayWIB(date)
  const start = new Date(`${day}T${startTime.padStart(5, '0')}:00+07:00`)
  // ponytail: startTime rusak → anggap mulai 00:00 WIB supaya tutor tidak terkunci oleh data jelek.
  return Number.isNaN(start.getTime()) ? new Date(`${day}T00:00:00+07:00`) : start
}

export function checkInOpensAt(date: Date, startTime: string): Date {
  return new Date(scheduleStartAt(date, startTime).getTime() - CHECKIN_OPENS_MINUTES_BEFORE * 60 * 1000)
}

export function checkInWindow(date: Date, startTime: string, now: Date = new Date()): CheckInWindow {
  if (now < checkInOpensAt(date, startTime)) return 'not-open'
  const closesAt = new Date(`${scheduleDayWIB(date)}T23:59:59.999+07:00`)
  return now <= closesAt ? 'open' : 'closed'
}

export function isLateCheckIn(date: Date, startTime: string, checkedInAt: Date): boolean {
  return checkedInAt > scheduleStartAt(date, startTime)
}

export function decideReportAccess(input: {
  scheduleDate: Date
  hasValidCheckIn: boolean
  requestStatus: ReportAccessRequestStatus | null
}): { allowed: boolean; reason: ReportAccessReason } {
  if (scheduleDayWIB(input.scheduleDate) < REPORT_GATE_FROM) return { allowed: true, reason: 'exempt' }
  if (input.hasValidCheckIn) return { allowed: true, reason: 'checked-in' }
  if (input.requestStatus === 'APPROVED') return { allowed: true, reason: 'approved' }
  return { allowed: false, reason: 'no-checkin' }
}
