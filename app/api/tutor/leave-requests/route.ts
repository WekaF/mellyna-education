import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requests = await prisma.tutorLeaveRequest.findMany({
    where: { tutorId: (session.user as any).id },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json({ requests })
}

// Tutor mengajukan izin sendiri — masuk PENDING, menunggu keputusan admin.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { date, reason } = await req.json()
  if (typeof date !== 'string' || !date || typeof reason !== 'string' || !reason) {
    return NextResponse.json({ error: 'date dan reason wajib diisi' }, { status: 400 })
  }

  const request_ = await prisma.tutorLeaveRequest.create({
    data: {
      tutorId: (session.user as any).id,
      date: new Date(date),
      reason,
      source: 'TUTOR_REQUEST',
      status: 'PENDING',
    },
  })

  return NextResponse.json({ request: request_ })
}
