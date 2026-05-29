import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const DAY_ORDER: Record<string, number> = {
  'Senin': 1,
  'Selasa': 2,
  'Rabu': 3,
  'Kamis': 4,
  "Jum'at": 5,
  'Sabtu': 6,
  'Minggu': 7,
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const list = await prisma.dailyPiket.findMany()
    // Sort logically by day order
    list.sort((a, b) => (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99))
    return NextResponse.json(list)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { day, staff } = body

    if (!day || staff === undefined) {
      return NextResponse.json({ error: 'Data tidak lengkap.' }, { status: 400 })
    }

    const updated = await prisma.dailyPiket.upsert({
      where: { day },
      update: { staff },
      create: { day, staff },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
