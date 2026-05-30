import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendWhatsApp, sleep, randomDelay } from '@/lib/waha'
import {
  buildAdminDailyDigestMessage,
  buildParentWeeklyDigestMessage,
} from '@/lib/report-notify'

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

  const type = searchParams.get('type') ?? 'daily'

  if (type === 'daily') return runDailyAdminDigest()
  if (type === 'weekly') return runWeeklyParentDigest()

  return NextResponse.json({ error: 'Invalid type. Use daily or weekly.' }, { status: 400 })
}

async function runDailyAdminDigest(): Promise<NextResponse> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const yesterdayEnd = new Date(yesterday)
  yesterdayEnd.setHours(23, 59, 59, 999)

  const reports = await prisma.learningReport.findMany({
    where: { createdAt: { gte: yesterday, lte: yesterdayEnd } },
    include: {
      student: { select: { name: true } },
      tutor: { select: { name: true } },
      schedule: { include: { class: { select: { name: true } } } },
    },
  })

  if (reports.length === 0) {
    return NextResponse.json({ success: true, message: 'Tidak ada laporan kemarin.', sent: 0 })
  }

  const admins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: { phone: true, name: true },
  })

  const message = buildAdminDailyDigestMessage(
    yesterday,
    reports.map((r) => ({
      studentName: r.student.name,
      className: r.schedule.class.name,
      tutorName: r.tutor.name,
      score: r.score,
    }))
  )

  let sent = 0
  for (const admin of admins) {
    if (!admin.phone) continue
    const ok = await sendWhatsApp(admin.phone, message)
    if (ok) sent++
    await sleep(randomDelay(2000, 4000))
  }

  return NextResponse.json({ success: true, reportCount: reports.length, adminsSent: sent })
}

async function runWeeklyParentDigest(): Promise<NextResponse> {
  const now = new Date()
  const dow = now.getDay()
  const daysToLastMon = dow === 0 ? 6 : dow - 1

  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - daysToLastMon - 7)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const parents = await prisma.user.findMany({
    where: {
      role: 'PARENT',
      phone: { not: null },
      children: {
        some: {
          reports: {
            some: { createdAt: { gte: weekStart, lte: weekEnd } },
          },
        },
      },
    },
    select: {
      name: true,
      phone: true,
      children: {
        select: {
          name: true,
          reports: {
            where: { createdAt: { gte: weekStart, lte: weekEnd } },
            include: {
              schedule: { include: { class: { select: { name: true } } } },
              tutor: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  let sent = 0
  for (const parent of parents) {
    if (!parent.phone) continue

    const digestItems = parent.children.flatMap((child) =>
      child.reports.map((r) => ({
        studentName: child.name,
        className: r.schedule.class.name,
        score: r.score,
        content: r.content,
        tutorName: r.tutor.name,
      }))
    )

    if (digestItems.length === 0) continue

    const message = buildParentWeeklyDigestMessage(parent.name, weekStart, weekEnd, digestItems)
    const ok = await sendWhatsApp(parent.phone, message)
    if (ok) sent++
    await sleep(randomDelay(3000, 7000))
  }

  return NextResponse.json({ success: true, weekStart, weekEnd, parentsSent: sent })
}
