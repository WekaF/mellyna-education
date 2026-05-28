import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendWhatsApp } from '@/lib/waha'

const schema = z.object({
  parentId: z.string().min(1),
  message: z.string().min(1).max(1000),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const parent = await prisma.user.findUnique({
    where: { id: parsed.data.parentId },
    select: { name: true, phone: true },
  })

  if (!parent) return NextResponse.json({ error: 'Parent not found' }, { status: 404 })
  if (!parent.phone) return NextResponse.json({ error: 'Orang tua tidak memiliki nomor HP.' }, { status: 422 })

  const success = await sendWhatsApp(parent.phone, parsed.data.message)
  if (!success) {
    return NextResponse.json({ error: 'Gagal mengirim pesan WhatsApp.' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
