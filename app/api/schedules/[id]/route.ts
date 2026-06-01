import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteFile } from '@/lib/storage'

const updateScheduleSchema = z.object({
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  topic: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED']).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: {
      class: {
        include: {
          tutor: { select: { name: true, email: true } },
        },
      },
      participants: {
        include: {
          student: { select: { id: true, name: true, grade: true } },
        },
        orderBy: { student: { name: 'asc' } },
      },
      attendances: { include: { student: true } },
    },
  })

  if (!schedule) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  return NextResponse.json(schedule)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id

  if (role !== 'SUPER_ADMIN' && role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const existing = await prisma.schedule.findUnique({
    where: { id },
    include: {
      class: {
        select: {
          tutorId: true,
          additionalTutors: {
            where: { tutorId: userId },
            select: { tutorId: true },
          },
        },
      },
    },
  })
  if (!existing) return NextResponse.json({ error: 'Not Found' }, { status: 404 })

  if (role === 'TUTOR' && existing.class.tutorId !== userId && existing.class.additionalTutors.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = updateScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { date, ...rest } = parsed.data

  const updateData =
    role === 'SUPER_ADMIN'
      ? { ...rest, ...(date ? { date: new Date(date) } : {}) }
      : { topic: rest.topic, location: rest.location }

  const schedule = await prisma.schedule.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json(schedule)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  // Collect all media files linked to this schedule's reports before deleting
  const bucket = process.env.MINIO_BUCKET ?? 'mellyna-media'
  const mediaFiles = await prisma.media.findMany({
    where: { report: { scheduleId: id } },
    select: { url: true },
  })

  // Delete MinIO objects first (best-effort — don't fail if storage errors)
  await Promise.allSettled(
    mediaFiles.map(({ url }) => {
      const key = url.split(`/${bucket}/`)[1]
      if (!key) return Promise.resolve()
      return deleteFile(key).catch(err =>
        console.error(`[Schedule Delete] MinIO delete failed for key ${key}:`, err)
      )
    })
  )

  await prisma.$transaction([
    prisma.attendance.deleteMany({ where: { scheduleId: id } }),
    prisma.learningReport.deleteMany({ where: { scheduleId: id } }),
    prisma.schedule.delete({ where: { id } }),
  ])

  return NextResponse.json({ success: true })
}
