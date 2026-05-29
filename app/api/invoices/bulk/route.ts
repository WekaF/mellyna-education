import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

const bulkInvoiceSchema = z.object({
  classId: z.string().min(1),
  amount: z.number().int().positive(),
  description: z.string().min(1),
  dueDate: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = bulkInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { classId, amount, description, dueDate } = parsed.data

  const enrollments = await prisma.enrollment.findMany({
    where: { classId, student: { isActive: true } },
    select: { studentId: true },
  })

  if (enrollments.length === 0) {
    return NextResponse.json({ error: 'Tidak ada siswa aktif di kelas ini.' }, { status: 422 })
  }

  const invoices = await prisma.invoice.createMany({
    data: enrollments.map((e) => ({
      studentId: e.studentId,
      amount,
      description,
      dueDate: new Date(dueDate),
    })),
    skipDuplicates: false,
  })

  return NextResponse.json({ created: invoices.count }, { status: 201 })
}
