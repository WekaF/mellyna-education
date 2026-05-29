import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { snap } from '@/lib/midtrans'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!snap) {
    return NextResponse.json({ error: 'Midtrans belum dikonfigurasi.' }, { status: 503 })
  }

  try {
    const { invoiceId } = await req.json()
    if (!invoiceId) return NextResponse.json({ error: 'invoiceId diperlukan.' }, { status: 400 })

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        student: {
          include: { parent: true },
        },
      },
    })

    if (!invoice) return NextResponse.json({ error: 'Invoice tidak ditemukan.' }, { status: 404 })
    if (invoice.status === 'PAID') return NextResponse.json({ error: 'Invoice sudah lunas.' }, { status: 400 })

    const orderId = `INV-${invoice.id}-${Date.now()}`

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: invoice.amount,
      },
      customer_details: {
        first_name: invoice.student.parent.name,
        email: invoice.student.parent.email,
        phone: invoice.student.parent.phone || '',
      },
      item_details: [
        {
          id: invoice.id,
          price: invoice.amount,
          quantity: 1,
          name: invoice.description.substring(0, 50),
        },
      ],
      enabled_payments: [
        'bri_va',
        'gopay',
        'shopeepay',
        'qris',
        'alfamart',
        'indomaret',
      ],
    }

    const transaction = await snap.createTransaction(parameter)

    // Save payment record
    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: invoice.amount,
        status: 'PENDING',
        snapToken: transaction.token,
        snapUrl: transaction.redirect_url,
      },
    })

    // Update invoice with midtrans order id
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { midtransId: orderId },
    })

    return NextResponse.json({
      token: transaction.token,
      redirectUrl: transaction.redirect_url,
      paymentId: payment.id,
    })
  } catch (error) {
    console.error('[Midtrans Payment Error]', error)
    return NextResponse.json({ error: 'Gagal membuat sesi pembayaran.' }, { status: 500 })
  }
}
