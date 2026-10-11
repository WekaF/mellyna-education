import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const decisionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  adminNote: z.string().trim().max(500).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = decisionSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'status harus APPROVED atau REJECTED' }, { status: 400 })
  }

  const { id } = await params
  const existing = await prisma.reportAccessRequest.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Permintaan tidak ditemukan.' }, { status: 404 })

  const request = await prisma.reportAccessRequest.update({
    where: { id },
    data: {
      status: parsed.data.status,
      adminNote: parsed.data.adminNote || null,
      decidedAt: new Date(),
      decidedById: (session.user as any).id,
    },
    select: { id: true, status: true, adminNote: true },
  })

  return NextResponse.json(request)
}
