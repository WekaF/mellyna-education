import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getTutorReportAccess, type TutorReportAccess } from '@/lib/report-access'

const requestSchema = z.object({
  scheduleId: z.string().min(1),
  reason: z.string().trim().min(5).max(500),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scheduleId = new URL(req.url).searchParams.get('scheduleId')
  if (!scheduleId) return NextResponse.json({ error: 'scheduleId wajib diisi' }, { status: 400 })

  // Hanya TUTOR yang dikunci; role lain selalu boleh.
  if ((session.user as any).role !== 'TUTOR') {
    const open: TutorReportAccess = { allowed: true, reason: 'exempt', checkInWindow: null, request: null }
    return NextResponse.json(open)
  }

  return NextResponse.json(await getTutorReportAccess((session.user as any).id, scheduleId))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = requestSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Alasan wajib diisi (5–500 karakter).' }, { status: 400 })
  }

  const tutorId = (session.user as any).id
  const { scheduleId, reason } = parsed.data

  const access = await getTutorReportAccess(tutorId, scheduleId)
  if (access.reason === 'schedule-not-found') {
    return NextResponse.json({ error: 'Jadwal tidak ditemukan.' }, { status: 404 })
  }
  if (access.allowed) {
    return NextResponse.json({ error: 'Akses laporan untuk jadwal ini sudah terbuka.' }, { status: 409 })
  }
  if (access.request?.status === 'PENDING') {
    return NextResponse.json({ error: 'Permintaan sedang menunggu persetujuan Super Admin.' }, { status: 409 })
  }

  const request = await prisma.reportAccessRequest.upsert({
    where: { tutorId_scheduleId: { tutorId, scheduleId } },
    create: { tutorId, scheduleId, reason },
    update: { reason, status: 'PENDING', adminNote: null, decidedAt: null, decidedById: null },
    select: { id: true, status: true, reason: true, adminNote: true },
  })

  return NextResponse.json(request, { status: 201 })
}
