import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkRadius, getTodayWIB } from '@/lib/geolocation'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tutorId = (session.user as any).id
  const body = await req.json()
  const { latitude, longitude } = body

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return NextResponse.json({ error: 'latitude dan longitude wajib diisi' }, { status: 400 })
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: 'Koordinat GPS tidak valid' }, { status: 400 })
  }

  const today = getTodayWIB()

  const todayStart = new Date(`${today}T00:00:00+07:00`)
  const todayEnd = new Date(`${today}T23:59:59+07:00`)
  const hasScheduleToday = await prisma.schedule.findFirst({
    where: {
      date: { gte: todayStart, lte: todayEnd },
      status: { in: ['PUBLISHED', 'COMPLETED'] },
      OR: [
        { class: { tutorId } },
        { class: { additionalTutors: { some: { tutorId } } } },
      ],
    },
  })
  if (!hasScheduleToday) {
    return NextResponse.json(
      { error: 'Tidak ada jadwal mengajar hari ini.' },
      { status: 422 },
    )
  }

  const { isWithinRadius, distanceM } = checkRadius(latitude, longitude)

  const checkIn = await prisma.tutorCheckIn.upsert({
    where: { tutorId_date: { tutorId, date: today } },
    update: { latitude, longitude, distanceM, isWithinRadius, checkedInAt: new Date() },
    create: { tutorId, date: today, latitude, longitude, distanceM, isWithinRadius },
  })

  if (!isWithinRadius) {
    return NextResponse.json(
      {
        success: false,
        isWithinRadius: false,
        distanceM: Math.round(distanceM),
        message: `Anda berada ${Math.round(distanceM)}m dari lokasi bimbel. Maksimal 500m.`,
      },
      { status: 422 },
    )
  }

  return NextResponse.json({
    success: true,
    isWithinRadius: true,
    distanceM: Math.round(distanceM),
    checkedInAt: checkIn.checkedInAt.toISOString(),
    message: `Absen berhasil! Jarak: ${Math.round(distanceM)}m`,
  })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tutorId = (session.user as any).id
  const today = getTodayWIB()

  const checkIn = await prisma.tutorCheckIn.findUnique({
    where: { tutorId_date: { tutorId, date: today } },
  })

  return NextResponse.json(
    checkIn
      ? {
          checkedIn: checkIn.isWithinRadius,
          checkedInAt: checkIn.checkedInAt.toISOString(),
          distanceM: Math.round(checkIn.distanceM),
          isWithinRadius: checkIn.isWithinRadius,
        }
      : { checkedIn: false },
  )
}
