import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
  const search   = searchParams.get('search')?.trim()   ?? ''
  const classId  = searchParams.get('classId')?.trim()  ?? ''
  const dateFrom = searchParams.get('dateFrom')?.trim() ?? ''
  const dateTo   = searchParams.get('dateTo')?.trim()   ?? ''

  const scheduleFilter: Record<string, unknown> = {}
  if (classId) scheduleFilter.classId = classId
  if (dateFrom || dateTo) {
    scheduleFilter.date = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(new Date(dateTo).setHours(23, 59, 59, 999)) } : {}),
    }
  }

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { student:  { name:  { contains: search, mode: 'insensitive' } } },
      { schedule: { class: { name: { contains: search, mode: 'insensitive' } } } },
    ]
  }
  if (Object.keys(scheduleFilter).length > 0) {
    where.schedule = scheduleFilter
  }

  const [total, rawReports] = await Promise.all([
    prisma.learningReport.count({ where }),
    prisma.learningReport.findMany({
      where,
      include: {
        student:  { select: { id: true, name: true } },
        tutor:    { select: { name: true } },
        schedule: {
          select: {
            date: true,
            topic: true,
            class: { select: { id: true, name: true } },
          },
        },
        media: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  const reports = rawReports.map((r) => ({
    id:        r.id,
    content:   r.content,
    score:     r.score,
    createdAt: r.createdAt.toISOString(),
    student:   { id: r.student.id, name: r.student.name },
    tutor:     { name: r.tutor.name },
    schedule: {
      date:  r.schedule.date.toISOString(),
      topic: r.schedule.topic,
      class: { id: r.schedule.class.id, name: r.schedule.class.name },
    },
    media: r.media.map((m) => ({
      id:       m.id,
      url:      m.url,
      type:     m.type,
      filename: m.filename,
    })),
  }))

  return NextResponse.json({ reports, total, page, pageCount: Math.ceil(total / limit), limit })
}
