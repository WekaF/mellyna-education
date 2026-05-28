import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadFile } from '@/lib/storage'
import { prisma } from '@/lib/db'

const MAX_SIZE = 50 * 1024 * 1024 // 50MB

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

    // Validate file type
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'Hanya file gambar atau video yang diizinkan.' }, { status: 400 })
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran file melebihi batas 50MB.' }, { status: 400 })
    }

    // Verify the report exists and belongs to this tutor
    const report = await prisma.learningReport.findUnique({ where: { id: reportId } })
    if (!report) return NextResponse.json({ error: 'Report tidak ditemukan.' }, { status: 404 })
    if (role === 'TUTOR' && report.tutorId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const url = await uploadFile(buffer, file.name, file.type)

    const media = await prisma.media.create({
      data: {
        reportId,
        url,
        type: file.type.startsWith('image/') ? 'PHOTO' : 'VIDEO',
        filename: file.name,
        size: file.size,
      },
    })

    return NextResponse.json(media, { status: 201 })
  } catch (error) {
    console.error('[Media Upload Error]', error)
    return NextResponse.json({ error: 'Gagal mengupload file.' }, { status: 500 })
  }
}
