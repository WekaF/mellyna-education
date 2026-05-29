import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const student = await prisma.student.findUnique({ where: { id }, select: { isActive: true } })
  if (!student) return NextResponse.json({ error: 'Not Found' }, { status: 404 })

  const updated = await prisma.student.update({
    where: { id },
    data: { isActive: !student.isActive },
    select: { id: true, isActive: true },
  })

  return NextResponse.json(updated)
}
