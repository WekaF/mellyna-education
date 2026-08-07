import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const createExpenseSchema = z
  .object({
    date: z.string().min(1),
    amount: z.number().int().positive(),
    description: z.string().min(1),
    categoryId: z.string().optional(),
    categoryName: z.string().optional(),
  })
  .refine((data) => Boolean(data.categoryId) !== Boolean(data.categoryName), {
    message: 'Provide exactly one of categoryId or categoryName',
  })

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null

  const dateFilter =
    month !== null && year !== null
      ? { date: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } }
      : year !== null
      ? { date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } }
      : {}

  const expenses = await prisma.expense.findMany({
    where: dateFilter,
    include: { category: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(expenses)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = createExpenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { date, amount, description, categoryId, categoryName } = parsed.data

  const resolvedCategoryId = categoryId
    ? categoryId
    : (
        await prisma.expenseCategory.upsert({
          where: { name: categoryName! },
          update: {},
          create: { name: categoryName! },
        })
      ).id

  const expense = await prisma.expense.create({
    data: {
      date: new Date(date),
      amount,
      description,
      categoryId: resolvedCategoryId,
      createdById: (session.user as any).id,
    },
    include: { category: { select: { id: true, name: true } } },
  })

  return NextResponse.json(expense, { status: 201 })
}
