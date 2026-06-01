import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const SETTING_DEFAULTS: Record<string, string> = {
  AUTO_TIMETABLE_BROADCAST: 'true',
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
  const setting = await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
  return NextResponse.json(setting)
}
