import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { sendWhatsAppFile, sendWhatsApp } from '@/lib/waha'
import { formatRupiah } from '@/lib/utils'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  if (!invoice) return NextResponse.json({ error: 'Invoice tidak ditemukan' }, { status: 404 })

  const parent = invoice.student.parent
  if (!parent) {
    return NextResponse.json({ error: 'Data orang tua tidak ditemukan' }, { status: 422 })
  }
  const phone = parent.phone
  if (!phone) {
    return NextResponse.json({ error: 'Orang tua tidak memiliki nomor HP' }, { status: 422 })
  }

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

    const base64 = Buffer.from(pdfBuffer).toString('base64')
    const y = invoice.createdAt.getFullYear()
    const m = String(invoice.createdAt.getMonth() + 1).padStart(2, '0')
    const invNo = `INV-${y}${m}-${invoice.id.slice(-6).toUpperCase()}`
    const filename = `${invNo}.pdf`

    const caption =
      `Halo ${parent.name},\n\n` +
      `Berikut kami lampirkan invoice tagihan bimbingan belajar untuk ${invoice.student.name}.\n\n` +
      `No. Invoice : ${invNo}\n` +
      `Keterangan  : ${invoice.description}\n` +
      `Nominal     : ${formatRupiah(invoice.amount)}\n` +
      `Jatuh Tempo : ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(invoice.dueDate)}\n\n` +
      `Terima kasih,\nMellyna Education`

    const result = await sendWhatsAppFile(phone, base64, filename, 'application/pdf', caption)
    if (!result.ok) {
      // Fallback: send text-only if file sending is not supported (WAHA free engine)
      if (result.error.includes('422') || result.error.toLowerCase().includes('plus')) {
        const textSent = await sendWhatsApp(phone, caption)
        if (textSent) {
          return NextResponse.json({
            success: true,
            invoiceNo: invNo,
            sentTo: phone,
            note: 'Terkirim sebagai pesan teks (lampiran PDF tidak tersedia, perlu WAHA NOWEB engine)',
          })
        }
      }
      return NextResponse.json({ error: `Gagal mengirim via WhatsApp: ${result.error}` }, { status: 502 })
    }

    return NextResponse.json({ success: true, invoiceNo: invNo, sentTo: phone })
  } catch (e) {
    console.error('[Mellyna] send-wa failed:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
