import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { triggerSchedulePublished } from '@/lib/n8n'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const schedule = await prisma.schedule.update({
    where: { id },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  })

  // Fire-and-forget: trigger n8n webhook to send WhatsApp notifications
  triggerSchedulePublished(id).catch(console.error)

  return NextResponse.json(schedule)
}
