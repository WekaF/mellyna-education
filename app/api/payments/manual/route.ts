import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const schema = z.object({
  invoiceId: z.string().min(1),
  method: z.enum(['CASH', 'BRI_TRANSFER', 'OTHER']),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { invoiceId, method, notes } = parsed.data

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return NextResponse.json({ error: 'Invoice tidak ditemukan.' }, { status: 404 })
  if (invoice.status === 'PAID') return NextResponse.json({ error: 'Invoice sudah lunas.' }, { status: 400 })

  const now = new Date()

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: now },
    }),
    prisma.payment.create({
      data: {
        invoiceId,
        amount: invoice.amount,
        method,
        status: 'SUCCESS',
        paidAt: now,
        midtransData: notes ? { notes } : undefined,
      },
    }),
  ])

  return NextResponse.json({ success: true })
}
