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

  const status = req.nextUrl.searchParams.get('status')
  const requests = await prisma.tutorLeaveRequest.findMany({
    where: status ? { status: status as any } : undefined,
    include: { tutor: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json({ requests })
}

// Admin langsung menandai izin (auto APPROVED) — bukan alur pengajuan tutor.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { tutorId, date, reason } = await req.json()
  if (typeof tutorId !== 'string' || !tutorId || typeof date !== 'string' || !date) {
    return NextResponse.json({ error: 'tutorId dan date wajib diisi' }, { status: 400 })
  }

  const request_ = await prisma.tutorLeaveRequest.create({
    data: {
      tutorId,
      date: new Date(date),
      reason: typeof reason === 'string' && reason ? reason : 'Ditandai admin',
      source: 'ADMIN_MARKED',
      status: 'APPROVED',
      decidedById: (session.user as any).id,
      decidedAt: new Date(),
    },
  })

  return NextResponse.json({ request: request_ })
}
