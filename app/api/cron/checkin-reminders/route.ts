import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendWhatsApp, sleep, randomDelay } from '@/lib/waha'
import { getTodayWIB } from '@/lib/geolocation'
import { isCheckInReminderDue } from '@/lib/checkin-policy'

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}

// Dipanggil n8n tiap 5 menit. Mengirim satu WA pengingat absen per jadwal ke tutor yang
// belum absen, sejak absen dibuka (30 menit sebelum sesi) sampai sesi mulai.
async function handleCron(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret') ?? req.headers.get('x-cron-secret')
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET ?? 'change-this-to-random-secret'

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized: Invalid cron secret.' }, { status: 401 })
  }

  try {
    const today = getTodayWIB()
    const candidates = await prisma.schedule.findMany({
      where: {
        date: {
          gte: new Date(`${today}T00:00:00+07:00`),
          lte: new Date(`${today}T23:59:59+07:00`),
        },
        status: 'PUBLISHED',
        checkInReminderSentAt: null,
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        class: {
          select: {
            name: true,
            tutor: { select: { id: true, name: true, phone: true } },
            additionalTutors: { select: { tutor: { select: { id: true, name: true, phone: true } } } },
          },
        },
        tutorCheckIns: { where: { isWithinRadius: true }, select: { tutorId: true } },
      },
    })

    const due = candidates.filter((s) => isCheckInReminderDue(s.date, s.startTime))

    let sent = 0
    let schedules = 0
    for (const s of due) {
      // Klaim dulu, baru kirim: dua pemanggilan cron yang tumpang tindih tidak mengirim dobel.
      const claimed = await prisma.schedule.updateMany({
        where: { id: s.id, checkInReminderSentAt: null },
        data: { checkInReminderSentAt: new Date() },
      })
      if (claimed.count === 0) continue
      schedules++

      const checkedIn = new Set(s.tutorCheckIns.map((c) => c.tutorId))
      const tutors = [s.class.tutor, ...s.class.additionalTutors.map((a) => a.tutor)]

      for (const tutor of tutors) {
        if (!tutor.phone || checkedIn.has(tutor.id)) continue

        const message = `Halo ${tutor.name},

Pengingat absen: sesi *${s.class.name}* mulai pukul ${s.startTime} hari ini (${s.startTime}–${s.endTime}).

Absen sudah dibuka. Saat sudah di lokasi bimbel, buka Dashboard Tutor lalu tekan *Absen Sekarang* pada jadwal ini.

Tanpa absen, laporan untuk sesi ini tidak bisa ditulis.

Mellyna Education`

        if (await sendWhatsApp(tutor.phone, message)) sent++
        await sleep(randomDelay(3000, 7000))
      }
    }

    return NextResponse.json({ success: true, schedules, sent })
  } catch (error: any) {
    console.error('[Cron Check-in Reminder] Failed:', error)
    return NextResponse.json({ error: error.message || 'Gagal memproses pengingat absen.' }, { status: 500 })
  }
}
