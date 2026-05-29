import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendWhatsApp, sleep, randomDelay } from '@/lib/waha'

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}

async function handleCron(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') ?? req.headers.get('x-cron-secret')
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET ?? 'change-this-to-random-secret'

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized: Invalid cron secret.' }, { status: 401 })
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Calculate exactly 7 days from now (date only)
    const target7Days = new Date(today)
    target7Days.setDate(today.getDate() + 7)

    const target7DaysStart = new Date(target7Days)
    const target7DaysEnd = new Date(target7Days)
    target7DaysEnd.setHours(23, 59, 59, 999)

    console.log(`[Billing Reminder] Scanning due dates between ${target7DaysStart.toISOString()} and ${target7DaysEnd.toISOString()}`)

    // 1. Find Invoices due in exactly 7 days
    const dueIn7DaysInvoices = await prisma.invoice.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          gte: target7DaysStart,
          lte: target7DaysEnd,
        },
      },
      include: {
        student: {
          include: {
            parent: { select: { name: true, phone: true } },
          },
        },
      },
    })

    let dueReminderCount = 0
    for (const inv of dueIn7DaysInvoices) {
      const parent = inv.student.parent
      if (!parent.phone) continue

      const dueDateStr = new Date(inv.dueDate).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      const formattedAmount = inv.amount.toLocaleString('id-ID')

      const message = `Halo Bunda/Ayah ${parent.name},

Mengingatkan bahwa tagihan belajar untuk ananda *${inv.student.name}* akan jatuh tempo dalam *7 hari lagi* (pada ${dueDateStr}).

Rincian Tagihan:
📋 Deskripsi: ${inv.description}
💰 Jumlah: Rp ${formattedAmount}
📅 Tanggal Jatuh Tempo: ${dueDateStr}

Mohon lakukan pembayaran tepat waktu melalui portal akademik Mellyna Education. Abaikan pesan ini jika Anda sudah melakukan pembayaran.

Terima kasih,
Mellyna Education`

      console.log(`[Billing Cron] Sending 7-day reminder to parent ${parent.name} (${parent.phone}) for Invoice ${inv.id}`)
      const success = await sendWhatsApp(parent.phone, message)
      if (success) dueReminderCount++
      await sleep(randomDelay(3000, 7000))
    }

    // 2. Find Pending Invoices that are Overdue (dueDate is in the past, status is PENDING)
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          lt: today,
        },
      },
      include: {
        student: {
          include: {
            parent: { select: { name: true, phone: true } },
          },
        },
      },
    })

    let overdueReminderCount = 0
    for (const inv of overdueInvoices) {
      const parent = inv.student.parent
      if (!parent.phone) continue

      const dueDateStr = new Date(inv.dueDate).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      const formattedAmount = inv.amount.toLocaleString('id-ID')

      const message = `Halo Bunda/Ayah ${parent.name},

Mohon maaf mengganggu, kami mendeteksi bahwa tagihan belajar untuk ananda *${inv.student.name}* belum melunasi pembayarannya yang telah jatuh tempo pada ${dueDateStr}.

Rincian Tagihan:
📋 Deskripsi: ${inv.description}
💰 Jumlah: Rp ${formattedAmount}
📅 Tanggal Jatuh Tempo: ${dueDateStr}
⚠️ Status: BELUM LUNAS

Mohon segera lakukan pembayaran melalui portal akademik Mellyna Education atau hubungi kami jika ada kendala.

Terima kasih,
Mellyna Education`

      console.log(`[Billing Cron] Sending overdue reminder to parent ${parent.name} (${parent.phone}) for Invoice ${inv.id}`)
      const success = await sendWhatsApp(parent.phone, message)
      if (success) overdueReminderCount++
      await sleep(randomDelay(3000, 7000))
    }

    return NextResponse.json({
      success: true,
      message: `Proses tagihan selesai. Dikirim: ${dueReminderCount} pengingat jatuh tempo (7 hari lagi) & ${overdueReminderCount} pengingat tunggakan (jatuh tempo lampau).`,
      sentDueReminders: dueReminderCount,
      sentOverdueReminders: overdueReminderCount,
    })
  } catch (error: any) {
    console.error('[Billing Cron] Error:', error)
    return NextResponse.json({ error: error.message || 'Gagal memproses pengingat tagihan.' }, { status: 500 })
  }
}
