import { prisma } from '@/lib/db'
import { CHECKIN_RADIUS_SETTING_KEY, parseCheckInRadius } from '@/lib/geolocation'

export async function getCheckInRadiusM(): Promise<number> {
  const row = await prisma.systemSetting.findUnique({ where: { key: CHECKIN_RADIUS_SETTING_KEY } })
  return parseCheckInRadius(row?.value)
}
