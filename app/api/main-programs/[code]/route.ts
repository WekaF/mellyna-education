import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const updateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const denied = await requireSuperAdmin()
  if (denied) return denied

  const { code } = await params
  const parsed = updateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existing = await prisma.mainProgram.findUnique({ where: { code } })
  if (!existing) return NextResponse.json({ error: 'Not Found' }, { status: 404 })

  const updated = await prisma.mainProgram.update({ where: { code }, data: parsed.data })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const denied = await requireSuperAdmin()
  if (denied) return denied

  const { code } = await params
  const existing = await prisma.mainProgram.findUnique({ where: { code } })
  if (!existing) return NextResponse.json({ error: 'Not Found' }, { status: 404 })

  const used = await prisma.class.count({ where: { mainProgram: code } })
  if (used > 0) {
    return NextResponse.json(
      { error: `Masih dipakai ${used} kelas. Nonaktifkan saja, atau pindahkan kelasnya dulu.` },
      { status: 409 },
    )
  }

  try {
    await prisma.mainProgram.delete({ where: { code } })
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      return NextResponse.json(
        { error: 'Masih dipakai kelas. Nonaktifkan saja, atau pindahkan kelasnya dulu.' },
        { status: 409 },
      )
    }
    throw e
  }
}
