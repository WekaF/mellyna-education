import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const students = await prisma.student.findMany({
    select: {
      id: true,
      name: true,
      grade: true,
      isActive: true,
      reports: {
        select: { score: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      attendances: {
        select: { status: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const result = students.map((s) => {
    const scoredReports = s.reports.filter((r) => r.score !== null)
    const avgScore = scoredReports.length > 0
      ? Math.round(scoredReports.reduce((sum, r) => sum + r.score!, 0) / scoredReports.length)
      : null
    const lastScore = scoredReports[0]?.score ?? null
    const lastActivity = s.reports[0]?.createdAt ?? null

    const total = s.attendances.length
    const present = s.attendances.filter((a) => a.status === 'PRESENT').length
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null

    let trend: 'up' | 'down' | 'stable' | null = null
    if (scoredReports.length >= 2) {
      const diff = scoredReports[0].score! - scoredReports[1].score!
      if (diff > 5) trend = 'up'
      else if (diff < -5) trend = 'down'
      else trend = 'stable'
    }

    return {
      id: s.id,
      name: s.name,
      grade: s.grade,
      isActive: s.isActive,
      totalReports: s.reports.length,
      avgScore,
      lastScore,
      lastActivity,
      attendanceRate,
      trend,
    }
  })

  return NextResponse.json(result)
}
