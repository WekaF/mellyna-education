import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const secret = _req.headers.get('x-internal-secret')
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: {
      class: { select: { name: true } },
      participants: {
        include: {
          student: {
            include: { parent: { select: { name: true, phone: true } } },
          },
        },
      },
    },
  })

  if (!schedule) return NextResponse.json({ error: 'Not Found' }, { status: 404 })

  const recipients = schedule.participants.map((p) => ({
    studentName: p.student.name,
    parentName: p.student.parent.name,
    parentPhone: p.student.parent.phone,
    topic: schedule.topic,
    date: schedule.date,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    className: schedule.class.name,
  }))

  return NextResponse.json({ scheduleId: schedule.id, recipients })
}
