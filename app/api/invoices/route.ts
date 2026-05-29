import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const createInvoiceSchema = z.object({
  studentId: z.string().min(1),
  amount: z.number().int().positive(),
  description: z.string().min(1),
  dueDate: z.string().min(1),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null
  const classId = searchParams.get('classId') ?? null

  const dateFilter =
    month !== null && year !== null
      ? {
          createdAt: {
            gte: new Date(year, month - 1, 1),
            lt: new Date(year, month, 1),
          },
        }
      : year !== null
      ? {
          createdAt: {
            gte: new Date(year, 0, 1),
            lt: new Date(year + 1, 0, 1),
          },
        }
      : {}

  const classFilter =
    classId
      ? {
          student: {
            enrollments: { some: { classId } },
          },
        }
      : {}

  let invoices
  if (role === 'PARENT') {
    invoices = await prisma.invoice.findMany({
      where: { student: { parentId: userId }, ...dateFilter },
      include: { student: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
  } else {
    invoices = await prisma.invoice.findMany({
      where: { ...dateFilter, ...classFilter },
      include: { student: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const invoice = await prisma.invoice.create({
    data: { ...parsed.data, dueDate: new Date(parsed.data.dueDate) },
  })

  return NextResponse.json(invoice, { status: 201 })
}
