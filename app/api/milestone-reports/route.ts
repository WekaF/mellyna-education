import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ReportPeriodType, Program } from '@prisma/client'
import {
  generateRaportPdf,
  type MilestoneSnapshotData,
  type SessionSummaryData,
} from '@/lib/milestone-report-pdf'
import { notifyParentMilestoneReport } from '@/lib/milestone-report-notify'

const PROGRAM_LABELS: Record<Program, string> = {
  SEMPOA: 'Sempoa',
  AHE: 'AHE',
  EFK: 'EFK',
  EYL: 'EYL',
  EFE: 'EFE',
  CALISTUNG: 'Calistung',
  ENGLISH: 'English',
}

const createSchema = z.object({
  studentId: z.string().min(1),
  periodType: z.nativeEnum(ReportPeriodType),
  periodLabel: z.string().min(1),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  notes: z.string().optional(),
  sendWhatsApp: z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId')

  if (role === 'PARENT') {
    const children = await prisma.student.findMany({
      where: { parentId: userId, isActive: true },
      select: { id: true },
    })
    const childIds = children.map((c) => c.id)
    const reports = await prisma.milestoneReport.findMany({
      where: { studentId: { in: childIds } },
      include: {
        student: { select: { name: true } },
        generatedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(reports)
  }

  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const reports = await prisma.milestoneReport.findMany({
    where: studentId ? { studentId } : {},
    include: {
      student: { select: { name: true } },
      generatedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(reports)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const generatedById = (session.user as any).id

  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const {
    studentId,
    periodType,
    periodLabel,
    periodStart,
    periodEnd,
    notes,
    sendWhatsApp: doNotify,
  } = parsed.data
  const start = new Date(periodStart)
  const end = new Date(periodEnd)

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { parent: { select: { name: true, phone: true } } },
  })
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  // Snapshot: current milestone statuses for this student
  const allMilestones = await prisma.milestone.findMany({
    orderBy: [{ program: 'asc' }, { order: 'asc' }],
    include: { studentMilestones: { where: { studentId } } },
  })

  const programs = Object.values(Program)
  const snapshot: MilestoneSnapshotData = {
    programs: programs
      .map((prog) => {
        const progMilestones = allMilestones.filter((m) => m.program === prog)
        if (progMilestones.length === 0) return null
        const milestones = progMilestones.map((m) => {
          const sm = m.studentMilestones[0]
          return {
            id: m.id,
            name: m.name,
            description: m.description,
            order: m.order,
            status: (sm?.status ?? 'NOT_STARTED') as
              | 'NOT_STARTED'
              | 'IN_PROGRESS'
              | 'COMPLETED',
            completedAt: sm?.completedAt ? sm.completedAt.toISOString() : null,
          }
        })
        const completedCount = milestones.filter((m) => m.status === 'COMPLETED').length
        const inProgressCount = milestones.filter((m) => m.status === 'IN_PROGRESS').length
        const notStartedCount = milestones.filter((m) => m.status === 'NOT_STARTED').length
        const totalCount = milestones.length
        const percent =
          totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
        return {
          program: prog,
          label: PROGRAM_LABELS[prog],
          completedCount,
          inProgressCount,
          notStartedCount,
          totalCount,
          percent,
          milestones,
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null),
  }

  // Session summary: LearningReports within the period date range
  const sessionReports = await prisma.learningReport.findMany({
    where: {
      studentId,
      schedule: { date: { gte: start, lte: end } },
    },
    select: { score: true },
  })
  const scores = sessionReports
    .map((r) => r.score)
    .filter((s): s is number => s !== null)
  const sessionSummary: SessionSummaryData = {
    totalSessions: sessionReports.length,
    avgScore:
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null,
  }

  const report = await prisma.milestoneReport.create({
    data: {
      studentId,
      periodType,
      periodLabel,
      periodStart: start,
      periodEnd: end,
      notes: notes ?? null,
      snapshotJson: snapshot as any,
      sessionSummary: sessionSummary as any,
      generatedById,
    },
  })

  // Optional WhatsApp delivery — wrapped so notification failure doesn't fail the request
  if (doNotify && student.parent.phone) {
    try {
      const pdfBuffer = generateRaportPdf({
        studentName: student.name,
        periodLabel,
        generatedAt: report.createdAt,
        notes: notes ?? null,
        snapshot,
        session: sessionSummary,
      })
      await notifyParentMilestoneReport({
        parentPhone: student.parent.phone,
        parentName: student.parent.name,
        studentName: student.name,
        periodLabel,
        snapshotSummary: snapshot.programs.map((p) => ({
          label: p.label,
          percent: p.percent,
          completedCount: p.completedCount,
          totalCount: p.totalCount,
        })),
        avgScore: sessionSummary.avgScore,
        totalSessions: sessionSummary.totalSessions,
        notes: notes ?? null,
        pdfBuffer,
        pdfFilename: `raport-${student.name.replace(/\s+/g, '-')}-${periodLabel.replace(/\s+/g, '-')}.pdf`,
      })
      await prisma.milestoneReport.update({
        where: { id: report.id },
        data: { notifiedAt: new Date() },
      })
    } catch (e) {
      console.error('[milestone-report] WhatsApp notification failed:', e)
    }
  }

  return NextResponse.json(report, { status: 201 })
}
