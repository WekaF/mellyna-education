import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PAYABLE_STATUSES } from '@/lib/invoice-status'

const schema = z.object({
  invoiceIds: z.array(z.string().min(1)).min(1).max(500),
  method: z.enum(['CASH', 'BRI_TRANSFER', 'OTHER']),
  notes: z.string().max(500).optional(),
})

class StatusConflictError extends Error {}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const ids = [...new Set(parsed.data.invoiceIds)]
  const { method, notes } = parsed.data
  const payable = { in: [...PAYABLE_STATUSES] }
  const now = new Date()

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const eligible = await tx.invoice.findMany({
        where: { id: { in: ids }, status: payable },
        select: { id: true, amount: true },
      })
      if (eligible.length === 0) return 0

      const { count } = await tx.invoice.updateMany({
        where: { id: { in: eligible.map((i) => i.id) }, status: payable },
        data: { status: 'PAID', paidAt: now },
      })
      // status berubah di antara findMany & updateMany (mis. webhook Midtrans) → rollback, cegah Payment dobel
      if (count !== eligible.length) throw new StatusConflictError()

      await tx.payment.createMany({
        data: eligible.map((i) => ({
          invoiceId: i.id,
          amount: i.amount,
          method,
          status: 'SUCCESS' as const,
          paidAt: now,
          midtransData: notes ? { notes } : undefined,
        })),
      })
      return eligible.length
    }, { timeout: 20000 }) // default 5s terlalu mepet untuk 500 baris

    return NextResponse.json({ updated, skipped: ids.length - updated })
  } catch (err) {
    if (err instanceof StatusConflictError) {
      return NextResponse.json(
        { error: 'Status sebagian tagihan baru saja berubah. Muat ulang lalu coba lagi.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'Gagal menyimpan pembayaran.' }, { status: 500 })
  }
}
