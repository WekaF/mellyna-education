import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const schema = z.object({
  name: z.string().min(1, 'Nama tidak boleh kosong'),
  phone: z.string().optional().nullable(),
  password: z.string().min(6).optional().nullable().or(z.literal('')),
})

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, phone, password } = parsed.data
  const updateData: any = { name, phone: phone || null }
  if (password && password.trim().length >= 6) {
    updateData.password = await bcrypt.hash(password, 12)
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true },
    })
    return NextResponse.json(user)
  } catch {
    return NextResponse.json({ error: 'Gagal memperbarui profil.' }, { status: 500 })
  }
}
