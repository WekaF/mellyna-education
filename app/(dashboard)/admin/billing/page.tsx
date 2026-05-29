import { prisma } from '@/lib/db'
import BillingClient from './BillingClient'

export default async function AdminBillingPage() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [rawInvoices, rawStudents, classes] = await Promise.all([
    prisma.invoice.findMany({
      where: { createdAt: { gte: startOfMonth } },
      select: {
        id: true,
        description: true,
        amount: true,
        dueDate: true,
        status: true,
        student: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.student.findMany({
      where: { isActive: true },
      select: { id: true, name: true, grade: true },
      orderBy: { name: 'asc' },
    }),
    prisma.class.findMany({
      select: { id: true, name: true, tutor: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
  ])

  const invoices = rawInvoices.map(inv => ({
    ...inv,
    dueDate: inv.dueDate.toISOString(),
  }))

  return (
    <BillingClient
      initialInvoices={invoices}
      initialStudents={rawStudents}
      initialClasses={classes}
    />
  )
}
