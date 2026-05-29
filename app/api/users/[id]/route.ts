import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, role: true, suspended: true, createdAt: true },
  })

  if (!user) return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 })
  return NextResponse.json(user)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, email, password, phone } = parsed.data

  // Check email uniqueness if email is changed
  if (email) {
    const existing = await prisma.user.findFirst({
      where: {
        email,
        id: { not: id },
      },
    })
    if (existing) {
      return NextResponse.json({ error: 'Email sudah digunakan oleh pengguna lain.' }, { status: 409 })
    }
  }

  const updateData: any = {}
  if (name !== undefined) updateData.name = name
  if (email !== undefined) updateData.email = email
  if (phone !== undefined) updateData.phone = phone
  if (password && password.trim().length >= 6) {
    updateData.password = await bcrypt.hash(password, 12)
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    })
    return NextResponse.json(user)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal mengubah data user.' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    // Check if the user is a super admin
    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (targetUser?.role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Tidak dapat menghapus Super Admin.' }, { status: 400 })
    }

    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal menghapus user.' }, { status: 500 })
  }
}
