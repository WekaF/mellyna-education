import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  generateRaportPdf,
  type MilestoneSnapshotData,
  type SessionSummaryData,
} from '@/lib/milestone-report-pdf'

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
    include: { student: { select: { name: true, parentId: true } } },
  })

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (role === 'PARENT' && report.student.parentId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pdfBuffer = generateRaportPdf({
    studentName: report.student.name,
    periodLabel: report.periodLabel,
    generatedAt: report.createdAt,
    notes: report.notes,
    snapshot: report.snapshotJson as unknown as MilestoneSnapshotData,
    session: report.sessionSummary as unknown as SessionSummaryData,
  })

  const filename = `raport-${report.student.name.replace(/\s+/g, '-')}-${report.periodLabel.replace(/\s+/g, '-')}.pdf`

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
