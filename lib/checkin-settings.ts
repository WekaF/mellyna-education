import { prisma } from '@/lib/db'
import { CHECKIN_RADIUS_SETTING_KEY, parseCheckInRadius } from '@/lib/geolocation'
import { CHECKIN_DAILY_TIME_SETTING_KEY, DAILY_CHECKIN_TIME, isValidDailyCheckInTime } from '@/lib/checkin-policy'

export async function getCheckInRadiusM(): Promise<number> {
  const row = await prisma.systemSetting.findUnique({ where: { key: CHECKIN_RADIUS_SETTING_KEY } })
  return parseCheckInRadius(row?.value)
}

// Jam target absen harian — bisa diatur Super Admin di Pengaturan (default 15:00 WIB).
export async function getDailyCheckInTime(): Promise<string> {
  const row = await prisma.systemSetting.findUnique({ where: { key: CHECKIN_DAILY_TIME_SETTING_KEY } })
  return isValidDailyCheckInTime(row?.value) ? row!.value : DAILY_CHECKIN_TIME
}
