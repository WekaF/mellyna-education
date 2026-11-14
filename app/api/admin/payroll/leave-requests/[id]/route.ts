import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Admin memutuskan pengajuan izin dari tutor (TUTOR_REQUEST) — approve atau reject.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { status } = await req.json()
  if (status !== 'APPROVED' && status !== 'REJECTED') {
    return NextResponse.json({ error: 'status harus APPROVED atau REJECTED' }, { status: 400 })
  }

  const { id } = await params
  const existing = await prisma.tutorLeaveRequest.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Pengajuan izin tidak ditemukan' }, { status: 404 })
  if (existing.status !== 'PENDING') {
    return NextResponse.json({ error: 'Pengajuan izin ini sudah diputuskan' }, { status: 422 })
  }

  const request_ = await prisma.tutorLeaveRequest.update({
    where: { id },
    data: { status, decidedById: (session.user as any).id, decidedAt: new Date() },
  })

  return NextResponse.json({ request: request_ })
}
