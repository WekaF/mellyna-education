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
  const type = searchParams.get('type') ?? 'daily'
  const dateStr = searchParams.get('date')

  if (type !== 'daily' && type !== 'weekly') {
    return NextResponse.json({ error: 'Invalid type. Use daily or weekly.' }, { status: 400 })
  }

  const date = dateStr ? new Date(dateStr) : new Date()

  let start: Date, end: Date

  if (type === 'daily') {
    start = new Date(date)
    start.setHours(0, 0, 0, 0)
    end = new Date(date)
    end.setHours(23, 59, 59, 999)
  } else {
    const dow = date.getDay()
    const daysToMon = dow === 0 ? 6 : dow - 1
    start = new Date(date)
    start.setDate(date.getDate() - daysToMon)
    start.setHours(0, 0, 0, 0)
    end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
  }

  try {
    const reports = await prisma.learningReport.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: {
        student: {
          select: {
            name: true,
            grade: true,
            parent: { select: { name: true } },
          },
        },
        tutor: { select: { name: true } },
        schedule: {
          include: { class: { select: { name: true } } },
        },
        media: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const byClass: Record<string, typeof reports> = {}
    for (const r of reports) {
      const cn = r.schedule?.class?.name ?? 'Unknown'
      if (!byClass[cn]) byClass[cn] = []
      byClass[cn].push(r)
    }

    const summary = Object.entries(byClass).map(([className, reps]) => {
      const scored = reps.filter((r) => r.score !== null)
      return {
        className,
        count: reps.length,
        avgScore:
          scored.length > 0
            ? Math.round(scored.reduce((s, r) => s + r.score!, 0) / scored.length)
            : null,
        reports: reps,
      }
    })

    return NextResponse.json({
      period: { type, start, end },
      totalReports: reports.length,
      byClass: summary,
    })
  } catch (e) {
    console.error('[Admin Digest] Failed to fetch reports:', e)
    return NextResponse.json({ error: 'Failed to fetch digest' }, { status: 500 })
  }
}
