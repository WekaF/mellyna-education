import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { triggerSchedulePublished } from '@/lib/n8n'
import { sendWhatsApp, sleep, randomDelay } from '@/lib/waha'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  // 1. Fetch full details of the schedule, class, tutor, enrollments, and parent phone numbers
  const scheduleWithDetails = await prisma.schedule.findUnique({
    where: { id },
    include: {
      class: {
        include: {
          tutor: { select: { name: true, phone: true } },
        },
      },
      participants: {
        include: {
          student: {
            include: {
              parent: { select: { name: true, phone: true } },
            },
          },
        },
      },
    },
  })

  if (!scheduleWithDetails) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
  }

  // 2. Update status to PUBLISHED
  const schedule = await prisma.schedule.update({
    where: { id },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  })

  // 3. Trigger WAHA Direct Broadcast to all session participants' parents
  const dateStr = new Date(scheduleWithDetails.date).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  const timeStr = `${scheduleWithDetails.startTime} - ${scheduleWithDetails.endTime}`
  const topicStr = scheduleWithDetails.topic ? `\n📚 Topik: ${scheduleWithDetails.topic}` : ''
  const locationStr = scheduleWithDetails.location ? `\n📍 Lokasi: ${scheduleWithDetails.location}` : ''

  // Dispatch WA messages asynchronously so it doesn't block the API response
  Promise.resolve().then(async () => {
    // Notify all participants' parents
    for (const p of scheduleWithDetails.participants) {
      const parent = p.student.parent
      if (!parent.phone) continue

      const message = `Halo Bunda/Ayah ${parent.name},

Berikut adalah jadwal belajar untuk ${p.student.name} besok:
🏫 Kelas: ${scheduleWithDetails.class.name}
👨‍🏫 Tutor: ${scheduleWithDetails.class.tutor.name}
🕐 Waktu: ${dateStr}, ${timeStr}${topicStr}${locationStr}

Sistem secara otomatis menjadwalkan ${p.student.name} untuk hadir. Jika berhalangan (sakit/izin), silakan hubungi kami dengan membalas pesan ini atau ajukan di portal akademik.

Terima kasih,
Mellyna Education`

      console.log(`[WAHA Broadcast] Sending schedule notification to parent ${parent.name} (${parent.phone})`)
      const success = await sendWhatsApp(parent.phone, message)
      if (success) {
        console.log(`[WAHA Broadcast] Successfully sent schedule notification to parent ${parent.name}`)
      } else {
        console.error(`[WAHA Broadcast] Failed to send schedule notification to parent ${parent.name}`)
      }
      await sleep(randomDelay(3000, 7000))
    }

    // Notify the tutor
    const tutor = scheduleWithDetails.class.tutor
    if (tutor.phone) {
      const studentNames = scheduleWithDetails.participants.map((p: { student: { name: string } }) => p.student.name).join(', ')
      const tutorMessage = `Halo ${tutor.name},

Anda mendapatkan jadwal mengajar:
🏫 Kelas: ${scheduleWithDetails.class.name}
🕐 Waktu: ${dateStr}, ${timeStr}${topicStr}${locationStr}
👥 Peserta (${scheduleWithDetails.participants.length} siswa): ${studentNames}

Silakan konfirmasi kehadiran siswa setelah sesi selesai melalui portal tutor.

Mellyna Education`

      console.log(`[WAHA Broadcast] Sending schedule notification to tutor ${tutor.name} (${tutor.phone})`)
      const success = await sendWhatsApp(tutor.phone, tutorMessage)
      if (success) {
        console.log(`[WAHA Broadcast] Successfully sent schedule notification to tutor ${tutor.name}`)
      } else {
        console.error(`[WAHA Broadcast] Failed to send schedule notification to tutor ${tutor.name}`)
      }
      await sleep(randomDelay(3000, 7000))
    }
  }).catch(console.error)

  // 4. Trigger n8n webhook as fallback/integration
  triggerSchedulePublished(id).catch(console.error)

  return NextResponse.json(schedule)
}
