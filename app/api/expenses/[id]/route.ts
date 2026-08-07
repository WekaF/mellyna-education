import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const updateExpenseSchema = z
  .object({
    date: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }).optional(),
    amount: z.number().int().positive().optional(),
    description: z.string().min(1).optional(),
    categoryId: z.string().optional(),
    categoryName: z.string().optional(),
  })
  .refine((data) => !(data.categoryId && data.categoryName), {
    message: 'Provide at most one of categoryId or categoryName',
  })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = updateExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { date, amount, description, categoryId, categoryName } = parsed.data

  const resolvedCategoryId = categoryName
    ? (
        await prisma.expenseCategory.upsert({
          where: { name: categoryName },
          update: {},
          create: { name: categoryName },
        })
      ).id
    : categoryId

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      date: date ? new Date(date) : undefined,
      amount,
      description,
      categoryId: resolvedCategoryId,
    },
    include: { category: { select: { id: true, name: true } } },
  })

  return NextResponse.json(expense)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  await prisma.expense.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
