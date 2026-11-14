import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tutorId = req.nextUrl.searchParams.get('tutorId')
  const entries = await prisma.tutorOvertimeEntry.findMany({
    where: tutorId ? { tutorId } : undefined,
    include: { tutor: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json({ entries })
}

// Tidak ada jam pulang di sistem, jadi lembur dicatat manual oleh admin per tanggal.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { tutorId, date, hours, note } = await req.json()
  if (typeof tutorId !== 'string' || !tutorId || typeof date !== 'string' || !date) {
    return NextResponse.json({ error: 'tutorId dan date wajib diisi' }, { status: 400 })
  }
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) {
    return NextResponse.json({ error: 'hours wajib diisi angka > 0' }, { status: 400 })
  }

  const entry = await prisma.tutorOvertimeEntry.create({
    data: {
      tutorId,
      date: new Date(date),
      hours,
      note: typeof note === 'string' && note ? note : null,
      createdById: (session.user as any).id,
    },
  })

  return NextResponse.json({ entry })
}
