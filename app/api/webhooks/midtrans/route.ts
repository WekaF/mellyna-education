import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { sendWhatsAppFile } from '@/lib/waha'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { order_id, status_code, gross_amount, signature_key, transaction_status } = body

    const serverKey = process.env.MIDTRANS_SERVER_KEY ?? ''
    const expectedSignature = createHash('sha512')
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest('hex')

    if (signature_key !== expectedSignature) {
      console.error('[Midtrans Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const invoice = await prisma.invoice.findFirst({
      where: { midtransId: order_id },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })

    if (!invoice) {
      console.error('[Midtrans Webhook] Invoice not found for order:', order_id)
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Idempotency guard: skip if already processed
    if (invoice.status === 'PAID' && (transaction_status === 'settlement' || transaction_status === 'capture')) {
      console.log(`[Midtrans Webhook] Invoice ${invoice.id} already PAID, skipping duplicate webhook`)
      return NextResponse.json({ status: 'ok' })
    }

    const paymentId = invoice.payments[0]?.id

    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      const paidAt = new Date()
      await prisma.$transaction([
        prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID', paidAt },
        }),
        ...(paymentId
          ? [
              prisma.payment.update({
                where: { id: paymentId },
                data: { status: 'SUCCESS', paidAt, midtransData: body },
              }),
            ]
          : []),
      ])

      // Auto-send PAID receipt via WhatsApp (fire and forget)
      void sendPaidReceipt(invoice.id, paidAt)
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

async function sendPaidReceipt(invoiceId: string, paidAt: Date): Promise<void> {
  try {
    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId },
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

    if (!inv?.student.parent?.phone) {
      console.warn(`[Midtrans] No parent phone for invoice ${invoiceId}, skipping receipt`)
      return
    }

    const pdfBuffer = await generateInvoicePdf({
      id: inv.id,
      description: inv.description,
      amount: inv.amount,
      dueDate: inv.dueDate,
      status: 'PAID',
      paidAt,
      createdAt: inv.createdAt,
      student: inv.student,
    })

    const y = inv.createdAt.getFullYear()
    const mo = String(inv.createdAt.getMonth() + 1).padStart(2, '0')
    const invNo = `INV-${y}${mo}-${inv.id.slice(-6).toUpperCase()}`
    const filename = `KWITANSI-${invNo}.pdf`
    const base64 = pdfBuffer.toString('base64')

    const fmt = (n: number) =>
      new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(n)

    const fmtDate = (d: Date) =>
      new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(d)

    const caption =
      `Terima kasih *${inv.student.parent.name}*! 🎉\n\n` +
      `Pembayaran untuk *${inv.student.name}* telah *berhasil dikonfirmasi*.\n\n` +
      `📄 No. Invoice: ${invNo}\n` +
      `💰 Nominal: ${fmt(inv.amount)}\n` +
      `📅 Tgl. Bayar: ${fmtDate(paidAt)}\n\n` +
      `Kwitansi terlampir. Terima kasih telah mempercayakan pendidikan anak kepada Mellyna Education! 🎓`

    await sendWhatsAppFile(inv.student.parent.phone, base64, filename, 'application/pdf', caption)
    console.log(`[Midtrans] Receipt sent to ${inv.student.parent.phone} for ${invNo}`)
  } catch (e) {
    console.error(`[Midtrans] Failed to send receipt for invoice ${invoiceId}:`, e)
  }
}

