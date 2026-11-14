import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.payrollEntry.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Payroll entry tidak ditemukan' }, { status: 404 })
  if (existing.status === 'FINALIZED') {
    return NextResponse.json({ error: 'Payroll entry ini sudah final' }, { status: 422 })
  }

  const entry = await prisma.payrollEntry.update({
    where: { id },
    data: { status: 'FINALIZED', finalizedAt: new Date(), finalizedById: (session.user as any).id },
  })

  return NextResponse.json({ entry })
}
