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

/** Return the Monday of the ISO week that `date` falls in. */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  // Work in UTC to avoid timezone shifts
  const dayOfWeek = d.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  d.setUTCDate(d.getUTCDate() - daysBack)
  d.setUTCHours(0, 0, 0, 0)
  return d
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
    const { startDate, selectedDays } = body
    if (!startDate) {
      return NextResponse.json({ error: 'Tanggal wajib diisi.' }, { status: 400 })
    }

    const inputDate = new Date(startDate)
    if (isNaN(inputDate.getTime())) {
      return NextResponse.json({ error: 'Format tanggal tidak valid.' }, { status: 400 })
    }
    const baseMonday = getMondayOfWeek(inputDate)
    const weekLabel = baseMonday.toISOString().split('T')[0]

    const ALL_DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
    const daysFilter: DayOfWeek[] = Array.isArray(selectedDays) && selectedDays.length > 0
      ? (selectedDays as string[]).filter(d => ALL_DAYS.includes(d as DayOfWeek)) as DayOfWeek[]
      : ALL_DAYS

    console.log(`[Timetable Generator] Input date ${startDate} → week of ${weekLabel}, days: ${daysFilter.join(', ')}`)

    // 1. Pre-flight WAHA check
    const wahaStatus = await getSessionStatus()
    if (wahaStatus !== 'WORKING') {
      console.warn(`[Timetable Generator] WAHA session not WORKING (${wahaStatus}). Schedules will be created but WA will not be sent.`)
    }

    // 2. Load all classes with active timetable settings
    const classes = await prisma.class.findMany({
      where: { dayOfWeek: { not: null, in: daysFilter }, timeSlot: { not: null } },
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
    let skippedCount = 0
    const generatedSchedules = []

    for (const c of classes) {
      const offset = DAY_OFFSETS[c.dayOfWeek!]
      const scheduleDate = new Date(baseMonday)
      scheduleDate.setUTCDate(scheduleDate.getUTCDate() + offset)
      scheduleDate.setUTCHours(0, 0, 0, 0)

      const { start, end } = getTimeRange(c.timeSlot!)

      // 3. Check if a schedule already exists for this class on this date to prevent duplication
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
        skippedCount++
        continue
      }

      // 4. Create the schedule in PUBLISHED status
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
      generatedSchedules.push(schedule)

      // 5. Dispatch WA Broadcast only if WAHA is WORKING
      if (wahaStatus === 'WORKING') {
        const dateStr = scheduleDate.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        const timeStr = `${start} - ${end}`

        Promise.resolve().then(async () => {
          const allTutors = [
            c.tutor,
            ...c.additionalTutors.map((at: { tutor: { name: string; phone: string | null } }) => at.tutor),
          ]
          const tutorNames = allTutors.map(t => t.name).join(', ')

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

            console.log(`[Timetable Auto-Broadcast] Sending WhatsApp to parent ${parent.name} (${parent.phone})`)
            await sendWhatsApp(parent.phone, message)
            await sleep(randomDelay(3000, 7000))
          }

          const studentNames = schedule.participants.map(p => p.student.name).join(', ')

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

            console.log(`[Timetable Auto-Broadcast] Sending WhatsApp to tutor ${tutorUser.name} (${tutorUser.phone})`)
            await sendWhatsApp(tutorUser.phone, tutorMessage)
            await sleep(randomDelay(3000, 7000))
          }
        }).catch(err => {
          console.error('[Timetable Auto-Broadcast] Broadcast error:', err)
        })
      }
    }

    // 6. Build result message
    let message = `${createdCount} jadwal berhasil dibuat.`
    if (skippedCount > 0) message += ` ${skippedCount} dilewati (jadwal sudah ada).`
    if (wahaStatus !== 'WORKING') {
      message += ` ⚠️ Notifikasi WA tidak terkirim — WAHA ${wahaStatus}.`
    } else if (createdCount > 0) {
      message += ' Notifikasi WA sedang dikirim.'
    }

    return NextResponse.json({
      success: true,
      message,
      created: createdCount,
      skipped: skippedCount,
      wahaStatus,
    })
  } catch (error: any) {
    console.error('[Timetable Generator] Generation failed:', error)
    return NextResponse.json({ error: error.message || 'Gagal memproses pembuatan jadwal.' }, { status: 500 })
  }
}
