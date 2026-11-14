import { prisma } from '@/lib/db'
import {
  checkInWindow,
  decideReportAccess,
  scheduleDayWIB,
  type CheckInWindow,
  type ReportAccessReason,
  type ReportAccessRequestStatus,
} from '@/lib/checkin-policy'

export type TutorReportAccess = {
  allowed: boolean
  reason: ReportAccessReason | 'schedule-not-found'
  checkInWindow: CheckInWindow | null
  request: {
    id: string
    status: ReportAccessRequestStatus
    reason: string
    adminNote: string | null
  } | null
}

export async function getTutorReportAccess(tutorId: string, scheduleId: string): Promise<TutorReportAccess> {
  const where = { tutorId_scheduleId: { tutorId, scheduleId } }
  const [schedule, checkIn, request] = await Promise.all([
    prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        OR: [
          { class: { tutorId } },
          { class: { additionalTutors: { some: { tutorId } } } },
        ],
      },
      select: { date: true, startTime: true },
    }),
    prisma.tutorCheckIn.findUnique({ where, select: { isWithinRadius: true } }),
    prisma.reportAccessRequest.findUnique({
      where,
      select: { id: true, status: true, reason: true, adminNote: true },
    }),
  ])

  if (!schedule) return { allowed: false, reason: 'schedule-not-found', checkInWindow: null, request: null }

  // Absen harian jam 15:00 (scheduleId: null) membuka akses laporan untuk semua jadwal hari itu.
  const dailyCheckIn = await prisma.tutorCheckIn.findFirst({
    where: { tutorId, scheduleId: null, date: scheduleDayWIB(schedule.date) },
    select: { isWithinRadius: true },
  })

  const decision = decideReportAccess({
    scheduleDate: schedule.date,
    hasValidCheckIn: (checkIn?.isWithinRadius ?? false) || (dailyCheckIn?.isWithinRadius ?? false),
    requestStatus: request?.status ?? null,
  })

  return { ...decision, checkInWindow: checkInWindow(schedule.date, schedule.startTime), request }
}
