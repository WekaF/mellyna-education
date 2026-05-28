import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteFile } from '@/lib/storage'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id

  if (role !== 'SUPER_ADMIN' && role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const media = await prisma.media.findUnique({
    where: { id },
    include: { report: { select: { tutorId: true } } },
  })

  if (!media) return NextResponse.json({ error: 'Media not found' }, { status: 404 })

  if (role === 'TUTOR' && media.report.tutorId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const bucket = process.env.MINIO_BUCKET ?? 'mellyna-media'
  const key = media.url.split(`/${bucket}/`)[1]

  if (key) {
    await deleteFile(key).catch((err) =>
      console.error('[Media Delete] MinIO delete failed, continuing with DB delete:', err)
    )
  }

  await prisma.media.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
