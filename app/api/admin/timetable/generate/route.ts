import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendWhatsApp, sleep, randomDelay, getSessionStatus } from '@/lib/waha'
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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { startDate } = body // e.g. "2026-06-01" (must be Monday of the target week)
    if (!startDate) {
      return NextResponse.json({ error: 'Tanggal awal (Senin) wajib diisi.' }, { status: 400 })
    }

    const baseMonday = new Date(startDate)
    if (isNaN(baseMonday.getTime())) {
      return NextResponse.json({ error: 'Format tanggal awal tidak valid.' }, { status: 400 })
    }

    console.log(`[Timetable Generator] Starting schedule generation from weekly timetable for week starting ${startDate}`)

    // 1. Load all classes with active timetable settings
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
    const generatedSchedules = []

    for (const c of classes) {
      const offset = DAY_OFFSETS[c.dayOfWeek!]
      const scheduleDate = new Date(baseMonday)
      scheduleDate.setDate(scheduleDate.getDate() + offset)
      // Set to midnight UTC or clean date representation
      scheduleDate.setHours(0, 0, 0, 0)

      const { start, end } = getTimeRange(c.timeSlot!)

      // 2. Check if a schedule already exists for this class on this date to prevent duplication
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
        console.log(`[Timetable Generator] Schedule for Class "${c.name}" on ${scheduleDate.toISOString().split('T')[0]} already exists. Skipping.`)
        continue
      }

      // 3. Create the schedule in PUBLISHED status
      const schedule = await prisma.schedule.create({
        data: {
          classId: c.id,
          date: scheduleDate,
          startTime: start,
          endTime: end,
          topic: `Sesi Belajar ${c.programs.map((p: { program: string }) => p.program).join(' + ')} - Rutin`,
          location: 'Ruang Belajar Mellyna',
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
      generatedSchedules.push(schedule)

      // 4. Dispatch WA Broadcast to Parents and Tutor asynchronously
      const dateStr = scheduleDate.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      const timeStr = `${start} - ${end}`

      Promise.resolve().then(async () => {
        const sessionStatus = await getSessionStatus()
        if (sessionStatus !== 'WORKING') {
          console.error(`[Timetable Auto-Broadcast] WAHA session not WORKING (status: ${sessionStatus}). Skipping broadcast for class ${c.name}.`)
          return
        }

        // Broadcast to parents
        const topicStr = schedule.topic ? `\n📚 Materi: ${schedule.topic}` : ''
        const locationStr = schedule.location ? `\n📍 Lokasi: ${schedule.location}` : ''

        const tutorNames = [
          c.tutor,
          ...c.additionalTutors.map((at: { tutor: { name: string; phone: string | null } }) => at.tutor),
        ].map(t => t.name).join(', ')

        for (const p of schedule.participants) {
          const parent = p.student.parent
          if (!parent.phone) continue

          const message = `Halo Bunda/Ayah ${parent.name},

Berikut adalah jadwal belajar untuk ${p.student.name}:
🏫 Kelas: ${c.name}
👨‍🏫 Tutor: ${tutorNames}
🕐 Waktu: ${dateStr}, ${timeStr}${topicStr}${locationStr}

Sistem secara otomatis menjadwalkan ${p.student.name} untuk hadir. Jika berhalangan (sakit/izin), silakan hubungi kami dengan membalas pesan ini atau ajukan di portal akademik.

Terima kasih,
Mellyna Education`

          console.log(`[Timetable Auto-Broadcast] Sending WhatsApp to parent ${parent.name} (${parent.phone})`)
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
📚 Materi: ${schedule.topic || '-'}
📍 Lokasi: ${schedule.location || '-'}
👥 Peserta (${schedule.participants.length} siswa): ${studentNames}

Silakan konfirmasi kehadiran siswa setelah sesi selesai melalui portal tutor.

Mellyna Education`

          console.log(`[Timetable Auto-Broadcast] Sending WhatsApp to tutor ${tutorUser.name} (${tutorUser.phone})`)
          await sendWhatsApp(tutorUser.phone, tutorMessage)
          await sleep(randomDelay(3000, 7000))
        }
      }).catch(err => {
        console.error('[Timetable Auto-Broadcast] Broadcast error:', err)
      })
    }

    return NextResponse.json({
      success: true,
      message: `${createdCount} jadwal sesi belajar berhasil dibuat dan disiarkan otomatis!`,
      count: createdCount,
    })
  } catch (error: any) {
    console.error('[Timetable Generator] Generation failed:', error)
    return NextResponse.json({ error: error.message || 'Gagal memproses pembuatan jadwal.' }, { status: 500 })
  }
}
