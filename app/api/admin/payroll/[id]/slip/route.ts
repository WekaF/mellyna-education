import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generatePayslipPdf, formatPayslipFilename } from '@/lib/payroll-pdf'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const entry = await prisma.payrollEntry.findUnique({
    where: { id },
    include: { tutor: { select: { name: true } } },
  })
  if (!entry) return NextResponse.json({ error: 'Payroll entry tidak ditemukan' }, { status: 404 })

  const pdfBuffer = await generatePayslipPdf(entry)

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${formatPayslipFilename(entry)}.pdf"`,
      'Content-Length': String(pdfBuffer.byteLength),
    },
  })
}
