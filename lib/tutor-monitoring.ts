import { isLateCheckIn, scheduleDayWIB, scheduleStartAt } from '@/lib/checkin-policy'

export type MonitoringSchedule = { id: string; date: Date; startTime: string }

export type MonitoringCheckIn = {
  id: string
  scheduleId: string | null
  date: string
  checkedInAt: Date
  distanceM: number
  isWithinRadius: boolean
}

export type CheckInRecord = {
  id: string
  date: string
  startTime: string | null
  checkedInAt: string
  distanceM: number
  isWithinRadius: boolean
  late: boolean
}

export type TutorAttendanceSummary = {
  totalSessions: number
  validSessions: number
  lateSessions: number
  attendanceRate: number | null
  avgDistanceM: number | null
  lastCheckIn: string | null
  recentCheckIns: CheckInRecord[]
}

// checkIns harus sudah diurutkan terbaru dulu (orderBy checkedInAt desc).
export function summarizeTutorAttendance(
  schedules: MonitoringSchedule[],
  checkIns: MonitoringCheckIn[],
  now: Date = new Date(),
): TutorAttendanceSummary {
  const started = schedules.filter((s) => scheduleStartAt(s.date, s.startTime) <= now)
  const byId = new Map(schedules.map((s) => [s.id, s]))
  const valid = checkIns.filter((c) => c.isWithinRadius)
  const validScheduleIds = new Set(valid.map((c) => c.scheduleId).filter(Boolean))
  // Absen lama (per hari, tanpa scheduleId) menutup semua jadwal di tanggal itu.
  const legacyDates = new Set(valid.filter((c) => c.scheduleId === null).map((c) => c.date))

  const isLate = (c: MonitoringCheckIn) => {
    const s = c.scheduleId ? byId.get(c.scheduleId) : undefined
    return !!s && isLateCheckIn(s.date, s.startTime, c.checkedInAt)
  }

  const validSessions = started.filter(
    (s) => validScheduleIds.has(s.id) || legacyDates.has(scheduleDayWIB(s.date)),
  ).length

  return {
    totalSessions: started.length,
    validSessions,
    lateSessions: valid.filter(isLate).length,
    attendanceRate: started.length > 0 ? Math.round((validSessions / started.length) * 100) : null,
    avgDistanceM:
      checkIns.length > 0
        ? Math.round(checkIns.reduce((sum, c) => sum + c.distanceM, 0) / checkIns.length)
        : null,
    lastCheckIn: checkIns[0]?.checkedInAt.toISOString() ?? null,
    recentCheckIns: checkIns.slice(0, 7).map((c) => ({
      id: c.id,
      date: c.date,
      startTime: (c.scheduleId && byId.get(c.scheduleId)?.startTime) || null,
      checkedInAt: c.checkedInAt.toISOString(),
      distanceM: Math.round(c.distanceM),
      isWithinRadius: c.isWithinRadius,
      late: isLate(c),
    })),
  }
}
