import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const { id } = await params

  if (role === 'TUTOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const report = await prisma.milestoneReport.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, name: true, parentId: true } },
      generatedBy: { select: { name: true } },
    },
  })

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (role === 'PARENT' && report.student.parentId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(report)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await prisma.milestoneReport.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
