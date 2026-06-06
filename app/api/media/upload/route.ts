import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadFile } from '@/lib/storage'
import { prisma } from '@/lib/db'
import { compressVideo } from '@/lib/video-compress'

const MAX_RAW_SIZE = 500 * 1024 * 1024 // 500MB raw input; videos are compressed before storing

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  if (role !== 'SUPER_ADMIN' && role !== 'TUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const reportId = formData.get('reportId') as string | null

    if (!file) return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 })
    if (!reportId) return NextResponse.json({ error: 'reportId diperlukan.' }, { status: 400 })

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'Hanya file gambar atau video yang diizinkan.' }, { status: 400 })
    }

    if (file.size > MAX_RAW_SIZE) {
      return NextResponse.json({ error: 'Ukuran file melebihi batas 500MB.' }, { status: 400 })
    }

    const report = await prisma.learningReport.findUnique({ where: { id: reportId } })
    if (!report) return NextResponse.json({ error: 'Report tidak ditemukan.' }, { status: 404 })
    if (role === 'TUTOR' && report.tutorId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let buffer: Buffer = Buffer.from(await file.arrayBuffer())
    let filename = file.name
    const isVideo = file.type.startsWith('video/')

    if (isVideo) {
      const compressed = await compressVideo(buffer, file.name)
      buffer = compressed.buffer
      filename = compressed.filename
    }

    const mimeType = isVideo ? 'video/mp4' : file.type
    const url = await uploadFile(buffer, filename, mimeType)

    const media = await prisma.media.create({
      data: {
        reportId,
        url,
        type: isVideo ? 'VIDEO' : 'PHOTO',
        filename,
        size: buffer.length,
      },
    })

    return NextResponse.json(media, { status: 201 })
  } catch (error) {
    console.error('[Media Upload Error]', error)
    return NextResponse.json({ error: 'Gagal mengupload file.' }, { status: 500 })
  }
}
