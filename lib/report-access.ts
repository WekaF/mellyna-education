import { prisma } from '@/lib/db'
import {
  checkInWindow,
  decideReportAccess,
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
    prisma.schedule.findUnique({ where: { id: scheduleId }, select: { date: true, startTime: true } }),
    prisma.tutorCheckIn.findUnique({ where, select: { isWithinRadius: true } }),
    prisma.reportAccessRequest.findUnique({
      where,
      select: { id: true, status: true, reason: true, adminNote: true },
    }),
  ])

  if (!schedule) return { allowed: false, reason: 'schedule-not-found', checkInWindow: null, request: null }

  const decision = decideReportAccess({
    scheduleDate: schedule.date,
    hasValidCheckIn: checkIn?.isWithinRadius ?? false,
    requestStatus: request?.status ?? null,
  })

  return { ...decision, checkInWindow: checkInWindow(schedule.date, schedule.startTime), request }
}
