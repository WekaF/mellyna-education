import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { toMainProgramCode } from '@/lib/main-program'

const createSchema = z.object({
  name: z.string().trim().min(1).max(50),
  order: z.number().int().min(0).optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await prisma.mainProgram.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { classes: true } } },
  })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { name, order } = parsed.data
  const code = toMainProgramCode(name)
  if (!code) return NextResponse.json({ error: 'Nama program harus mengandung huruf/angka.' }, { status: 400 })

  const exists = await prisma.mainProgram.findUnique({ where: { code } })
  if (exists) return NextResponse.json({ error: `Program utama "${code}" sudah ada.` }, { status: 409 })

  try {
    const created = await prisma.mainProgram.create({ data: { code, name, order: order ?? 0 } })
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: `Program utama "${code}" sudah ada.` }, { status: 409 })
    }
    throw e
  }
}
