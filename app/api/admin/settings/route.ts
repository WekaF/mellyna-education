import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  CHECKIN_RADIUS_MAX_M,
  CHECKIN_RADIUS_METERS,
  CHECKIN_RADIUS_MIN_M,
  CHECKIN_RADIUS_SETTING_KEY,
  isValidCheckInRadius,
} from '@/lib/geolocation'
import { CHECKIN_DAILY_TIME_SETTING_KEY, DAILY_CHECKIN_TIME, isValidDailyCheckInTime } from '@/lib/checkin-policy'

const SETTING_DEFAULTS: Record<string, string> = {
  AUTO_TIMETABLE_BROADCAST: 'true',
  [CHECKIN_RADIUS_SETTING_KEY]: String(CHECKIN_RADIUS_METERS),
  [CHECKIN_DAILY_TIME_SETTING_KEY]: DAILY_CHECKIN_TIME,
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const rows = await prisma.systemSetting.findMany()
  const result: Record<string, string> = { ...SETTING_DEFAULTS }
  for (const row of rows) result[row.key] = row.value
  return NextResponse.json(result)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { key, value } = body as Record<string, unknown>
  if (typeof key !== 'string' || typeof value !== 'string') {
    return NextResponse.json({ error: 'key and value must be strings' }, { status: 400 })
  }
  if (key === CHECKIN_RADIUS_SETTING_KEY && !isValidCheckInRadius(value)) {
    return NextResponse.json(
      { error: `Radius harus bilangan bulat ${CHECKIN_RADIUS_MIN_M}–${CHECKIN_RADIUS_MAX_M} meter.` },
      { status: 400 },
    )
  }
  if (key === CHECKIN_DAILY_TIME_SETTING_KEY && !isValidDailyCheckInTime(value)) {
    return NextResponse.json({ error: 'Jam absen harus format HH:MM, contoh 14:40.' }, { status: 400 })
  }
  const setting = await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
  return NextResponse.json(setting)
}
