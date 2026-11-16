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

// Pengingat WA dikirim sejak absen dibuka sampai sesi mulai; setelah itu sudah terlambat untuk diingatkan.
export function isCheckInReminderDue(date: Date, startTime: string, now: Date = new Date()): boolean {
  return now >= checkInOpensAt(date, startTime) && now <= scheduleStartAt(date, startTime)
}

export function isLateCheckIn(date: Date, startTime: string, checkedInAt: Date): boolean {
  return checkedInAt > scheduleStartAt(date, startTime)
}

// Absen harian — satu kali per tutor per hari, jam target bisa diatur admin (default 15:00 WIB), lepas dari jadwal kelas.
export const DAILY_CHECKIN_TIME = '15:00'
export const CHECKIN_DAILY_TIME_SETTING_KEY = 'CHECKIN_DAILY_TIME'

export function isValidDailyCheckInTime(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function dailyCheckInTargetAt(dateKeyWIB: string, targetTime: string = DAILY_CHECKIN_TIME): Date {
  return new Date(`${dateKeyWIB}T${targetTime}:00+07:00`)
}

export function dailyCheckInOpensAt(dateKeyWIB: string, targetTime: string = DAILY_CHECKIN_TIME): Date {
  return new Date(dailyCheckInTargetAt(dateKeyWIB, targetTime).getTime() - CHECKIN_OPENS_MINUTES_BEFORE * 60 * 1000)
}

export function dailyCheckInWindow(
  dateKeyWIB: string,
  now: Date = new Date(),
  targetTime: string = DAILY_CHECKIN_TIME,
): CheckInWindow {
  if (now < dailyCheckInOpensAt(dateKeyWIB, targetTime)) return 'not-open'
  const closesAt = new Date(`${dateKeyWIB}T23:59:59.999+07:00`)
  return now <= closesAt ? 'open' : 'closed'
}

export function isLateDailyCheckIn(
  dateKeyWIB: string,
  checkedInAt: Date,
  targetTime: string = DAILY_CHECKIN_TIME,
): boolean {
  return checkedInAt > dailyCheckInTargetAt(dateKeyWIB, targetTime)
}

// Laporan tidak lagi digembok oleh status absen — kelas pagi (jam 8/11) harus tetap bisa
// dilaporkan walau absen harian baru buka sore. Fungsi ini dipertahankan (bukan dihapus)
// supaya tipe TutorReportAccess & ReportAccessRequest tetap kompatibel kalau mau diaktifkan lagi.
export function decideReportAccess(_input: {
  scheduleDate: Date
  hasValidCheckIn: boolean
  requestStatus: ReportAccessRequestStatus | null
}): { allowed: boolean; reason: ReportAccessReason } {
  return { allowed: true, reason: 'exempt' }
}
