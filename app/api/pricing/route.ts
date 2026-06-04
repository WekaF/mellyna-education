import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { defaultSppTiers, defaultAdminFees } from '@/lib/constants/pricing'

export async function GET() {
  const [sppSetting, feesSetting] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: 'PRICING_SPP_TIERS' } }),
    prisma.systemSetting.findUnique({ where: { key: 'PRICING_ADMIN_FEES' } }),
  ])

  const sppTiers = sppSetting ? JSON.parse(sppSetting.value) : defaultSppTiers
  const adminFees = feesSetting ? JSON.parse(feesSetting.value) : defaultAdminFees

  return NextResponse.json({ sppTiers, adminFees })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  const ops: Promise<any>[] = []

  if (body.sppTiers !== undefined) {
    ops.push(
      prisma.systemSetting.upsert({
        where: { key: 'PRICING_SPP_TIERS' },
        update: { value: JSON.stringify(body.sppTiers) },
        create: { key: 'PRICING_SPP_TIERS', value: JSON.stringify(body.sppTiers) },
      })
    )
  }

  if (body.adminFees !== undefined) {
    ops.push(
      prisma.systemSetting.upsert({
        where: { key: 'PRICING_ADMIN_FEES' },
        update: { value: JSON.stringify(body.adminFees) },
        create: { key: 'PRICING_ADMIN_FEES', value: JSON.stringify(body.adminFees) },
      })
    )
  }

  await Promise.all(ops)
  return NextResponse.json({ ok: true })
}
