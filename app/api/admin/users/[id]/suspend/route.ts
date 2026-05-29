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

  const user = await prisma.user.findUnique({ where: { id }, select: { role: true, suspended: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Cannot suspend admin account' }, { status: 403 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { suspended: !user.suspended },
    select: { id: true, suspended: true },
  })

  return NextResponse.json(updated)
}
