import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateInvoicePdf } from '@/lib/invoice-pdf'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      student: {
        select: {
          name: true,
          grade: true,
          parent: { select: { name: true, phone: true, email: true } },
        },
      },
    },
  })

  if (!invoice) return NextResponse.json({ error: 'Not Found' }, { status: 404 })

  try {
    const pdfBuffer = await generateInvoicePdf({
      id: invoice.id,
      description: invoice.description,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      status: invoice.status as 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED',
      paidAt: invoice.paidAt,
      createdAt: invoice.createdAt,
      student: invoice.student,
    })

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${id}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (e) {
    console.error('[Mellyna] PDF generation failed:', e)
    return NextResponse.json({ error: 'Gagal membuat PDF' }, { status: 500 })
  }
}
