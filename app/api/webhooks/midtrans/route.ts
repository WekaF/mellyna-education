import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
    } = body

    // Verify Midtrans SHA-512 signature
    const serverKey = process.env.MIDTRANS_SERVER_KEY ?? ''
    const expectedSignature = createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest('hex')

    if (signature_key !== expectedSignature) {
      console.error('[Midtrans Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    // Find invoice by midtransId (orderId)
    const invoice = await prisma.invoice.findFirst({
      where: { midtransId: order_id },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })

    if (!invoice) {
      console.error('[Midtrans Webhook] Invoice not found for order:', order_id)
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const paymentId = invoice.payments[0]?.id

    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      // Mark invoice and payment as paid
      await prisma.$transaction([
        prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID', paidAt: new Date() },
        }),
        ...(paymentId ? [prisma.payment.update({
          where: { id: paymentId },
          data: { status: 'SUCCESS', paidAt: new Date(), midtransData: body },
        })] : []),
      ])
    } else if (['cancel', 'deny', 'expire'].includes(transaction_status)) {
      if (paymentId) {
        await prisma.payment.update({
          where: { id: paymentId },
          data: { status: 'FAILED', midtransData: body },
        })
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[Midtrans Webhook Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
