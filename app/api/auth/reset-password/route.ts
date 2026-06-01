import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()

  if (!token || !password || typeof token !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Kata sandi minimal 8 karakter.' }, { status: 400 })
  }

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } })

  if (!resetToken || resetToken.expires < new Date()) {
    return NextResponse.json(
      { error: 'Link reset tidak valid atau sudah kedaluwarsa.' },
      { status: 400 }
    )
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  await prisma.user.update({
    where: { id: resetToken.userId },
    data: { password: hashedPassword },
  })

  await prisma.passwordResetToken.delete({ where: { token } })

  return NextResponse.json({ message: 'Kata sandi berhasil diubah.' })
}
