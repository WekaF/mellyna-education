import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkRadius } from '@/lib/geolocation'
import { getCheckInRadiusM } from '@/lib/checkin-settings'
import {
  CHECKIN_OPENS_MINUTES_BEFORE,
  checkInWindow,
  isLateCheckIn,
  scheduleDayWIB,
} from '@/lib/checkin-policy'

function fail(message: string, status: number) {
  return NextResponse.json({ error: message, message }, { status })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tutorId = (session.user as any).id
  const { latitude, longitude, scheduleId, accuracy } = await req.json()
  const accuracyM = typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : 0

  if (typeof scheduleId !== 'string' || !scheduleId) {
    return fail('scheduleId wajib diisi', 400)
  }
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return fail('latitude dan longitude wajib diisi', 400)
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return fail('Koordinat GPS tidak valid', 400)
  }

  const schedule = await prisma.schedule.findFirst({
    where: {
      id: scheduleId,
      status: { in: ['PUBLISHED', 'COMPLETED'] },
      OR: [
        { class: { tutorId } },
        { class: { additionalTutors: { some: { tutorId } } } },
      ],
    },
    select: { id: true, date: true, startTime: true },
  })
  if (!schedule) return fail('Jadwal tidak ditemukan atau bukan jadwal Anda.', 404)

  const window = checkInWindow(schedule.date, schedule.startTime)
  if (window === 'not-open') {
    return fail(
      `Absen dibuka ${CHECKIN_OPENS_MINUTES_BEFORE} menit sebelum sesi mulai (${schedule.startTime}).`,
      422,
    )
  }
  if (window === 'closed') {
    return fail('Waktu absen untuk jadwal ini sudah lewat. Ajukan akses laporan ke Super Admin.', 422)
  }

  const radiusM = await getCheckInRadiusM()
  const where = { tutorId_scheduleId: { tutorId, scheduleId } }
  const existing = await prisma.tutorCheckIn.findUnique({ where })

  // Absen sah tidak boleh ditimpa oleh tap ulang (mis. dari luar radius).
  const checkIn = existing?.isWithinRadius
    ? existing
    : await (async () => {
        const { isWithinRadius, distanceM } = checkRadius(latitude, longitude, accuracyM, radiusM)
        return prisma.tutorCheckIn.upsert({
          where,
          update: { latitude, longitude, distanceM, accuracyM, isWithinRadius, checkedInAt: new Date() },
          create: {
            tutorId,
            scheduleId,
            date: scheduleDayWIB(schedule.date),
            latitude,
            longitude,
            distanceM,
            accuracyM,
            isWithinRadius,
          },
        })
      })()

  const distanceM = Math.round(checkIn.distanceM)

  if (!checkIn.isWithinRadius) {
    return NextResponse.json(
      {
        success: false,
        isWithinRadius: false,
        scheduleId,
        distanceM,
        message: `Anda terbaca ${distanceM}m dari titik absen (maksimal ${radiusM}m). Coba lagi di dekat jendela atau di luar ruangan supaya GPS lebih akurat.`,
      },
      { status: 422 },
    )
  }

  return NextResponse.json({
    success: true,
    isWithinRadius: true,
    scheduleId,
    distanceM,
    checkedInAt: checkIn.checkedInAt.toISOString(),
    late: isLateCheckIn(schedule.date, schedule.startTime, checkIn.checkedInAt),
    message: `Absen berhasil! Jarak: ${distanceM}m`,
  })
}
