import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Program } from '@prisma/client'

const createMilestoneSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  program: z.nativeEnum(Program),
  order: z.number().int().min(0).default(0),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const program = searchParams.get('program') as Program | null

  const milestones = await prisma.milestone.findMany({
    where: program ? { program } : {},
    orderBy: [{ program: 'asc' }, { order: 'asc' }],
  })

  return NextResponse.json(milestones)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createMilestoneSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const milestone = await prisma.milestone.create({ data: parsed.data })
  return NextResponse.json(milestone, { status: 201 })
}
