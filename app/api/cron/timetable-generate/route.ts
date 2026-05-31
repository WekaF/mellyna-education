import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendWhatsApp, sleep, randomDelay } from '@/lib/waha'
import { DayOfWeek, ScheduleStatus } from '@prisma/client'

const DAY_OFFSETS: Record<DayOfWeek, number> = {
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
  SATURDAY: 5,
  SUNDAY: 6,
}

function getTimeRange(slot: string): { start: string; end: string } {
  if (slot.includes(':')) {
    const [h, m] = slot.split(':').map(Number)
    const totalMins = h * 60 + m + 45
    const endH = Math.floor(totalMins / 60) % 24
    const endM = totalMins % 60
    return {
      start: slot,
      end: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`,
    }
  }
  const mapping: Record<string, { start: string; end: string }> = {
    'JAM 1': { start: '13:00', end: '13:45' },
    'JAM 2': { start: '14:00', end: '14:45' },
    'JAM 3': { start: '15:00', end: '15:45' },
    'JAM 4': { start: '16:00', end: '16:45' },
    'JAM 7': { start: '19:00', end: '19:45' },
  }
  return mapping[slot] ?? { start: '08:00', end: '08:45' }
}

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
    // 1. Calculate the date of next Monday automatically
    const today = new Date()
    const currentDay = today.getDay() // 0 = Sunday, 1 = Monday, etc.
    // Days until next Monday
    const daysUntilNextMonday = (1 - currentDay + 7) % 7 || 7
    const nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() + daysUntilNextMonday)
    nextMonday.setHours(0, 0, 0, 0)

    const nextMondayStr = nextMonday.toISOString().split('T')[0]
    console.log(`[Cron Timetable Scheduler] Triggered. Generating schedules for week starting ${nextMondayStr}`)

    // 2. Fetch all classes in timetable
    const classes = await prisma.class.findMany({
      where: { dayOfWeek: { not: null }, timeSlot: { not: null } },
      include: {
        tutor: { select: { name: true, phone: true } },
        additionalTutors: {
          include: {
            tutor: { select: { name: true, phone: true } },
          },
        },
        programs: { select: { program: true } },
        enrollments: {
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

    let createdCount = 0
    const generated = []

    for (const c of classes) {
      const offset = DAY_OFFSETS[c.dayOfWeek!]
      const scheduleDate = new Date(nextMonday)
      scheduleDate.setDate(scheduleDate.getDate() + offset)
      scheduleDate.setHours(0, 0, 0, 0)

      const { start, end } = getTimeRange(c.timeSlot!)

      // 3. Prevent duplicate creation
      const existing = await prisma.schedule.findFirst({
        where: {
          classId: c.id,
          date: {
            gte: new Date(scheduleDate.getTime()),
            lt: new Date(scheduleDate.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      })

      if (existing) {
        continue
      }

      // 4. Create Schedule
      const schedule = await prisma.schedule.create({
        data: {
          classId: c.id,
          date: scheduleDate,
          startTime: start,
          endTime: end,
          topic: `Sesi Belajar ${c.programs.map((p: { program: string }) => p.program).join(' + ')} - Rutin`,
          location: 'Sempoa Kreatif Pakong',
          status: ScheduleStatus.PUBLISHED,
          publishedAt: new Date(),
          participants: {
            create: c.enrollments.map(e => ({ studentId: e.studentId })),
          },
        },
        include: {
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

      createdCount++
      generated.push(schedule)

      // 5. Broadcast to parents & tutors
      const dateStr = scheduleDate.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      const timeStr = `${start} - ${end}`

      Promise.resolve().then(async () => {
        const tutorNames = [
          c.tutor,
          ...c.additionalTutors.map((at: { tutor: { name: string; phone: string | null } }) => at.tutor),
        ].map(t => t.name).join(', ')

        // Broadcast to parents
        for (const p of schedule.participants) {
          const parent = p.student.parent
          if (!parent.phone) continue

          const message = `Halo Bunda/Ayah ${parent.name},

Berikut adalah jadwal belajar rutin untuk ${p.student.name} besok:
🏫 Kelas: ${c.name}
👨‍🏫 Tutor: ${tutorNames}
🕐 Waktu: ${dateStr}, ${timeStr}
📍 Lokasi: Sempoa Kreatif Pakong

Sistem secara otomatis menjadwalkan ${p.student.name} untuk hadir. Jika berhalangan (sakit/izin), silakan hubungi kami dengan membalas pesan ini atau ajukan di portal akademik.

Terima kasih,
Mellyna Education`

          await sendWhatsApp(parent.phone, message)
          await sleep(randomDelay(3000, 7000))
        }

        // Broadcast to all tutors (primary + additional)
        const allTutors = [
          c.tutor,
          ...c.additionalTutors.map((at: { tutor: { name: string; phone: string | null } }) => at.tutor),
        ]
        const studentNames = schedule.participants.map((p: { student: { name: string } }) => p.student.name).join(', ')

        for (const tutorUser of allTutors) {
          if (!tutorUser.phone) continue
          const tutorMessage = `Halo ${tutorUser.name},

Jadwal mengajar rutin Anda telah diterbitkan secara otomatis dari Timetable:
🏫 Kelas: ${c.name}
🕐 Waktu: ${dateStr}, ${timeStr}
📍 Lokasi: Sempoa Kreatif Pakong
👥 Peserta (${schedule.participants.length} siswa): ${studentNames}

Silakan konfirmasi kehadiran siswa setelah sesi selesai melalui portal tutor.

Mellyna Education`

          await sendWhatsApp(tutorUser.phone, tutorMessage)
          await sleep(randomDelay(3000, 7000))
        }
      }).catch(err => {
        console.error('[Cron Timetable Auto-Broadcast] error:', err)
      })
    }

    return NextResponse.json({
      success: true,
      message: `Auto-Scheduler: Berhasil membuat dan merilis ${createdCount} jadwal untuk minggu depan (mulai ${nextMondayStr})!`,
      count: createdCount,
    })
  } catch (error: any) {
    console.error('[Cron Timetable Scheduler] Failed:', error)
    return NextResponse.json({ error: error.message || 'Gagal memproses Auto-Scheduler.' }, { status: 500 })
  }
}
