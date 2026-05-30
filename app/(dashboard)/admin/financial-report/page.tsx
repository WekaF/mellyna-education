import { prisma } from '@/lib/db'
import FinancialReportClient from './FinancialReportClient'

export default async function FinancialReportPage() {
  const now = new Date()
  const defaultMonth = String(now.getMonth() + 1)
  const defaultYear = String(now.getFullYear())

  const month = parseInt(defaultMonth)
  const year = parseInt(defaultYear)

  // mirrors /api/invoices GET (admin, default month/year, no classId filter)
  const dateFilter = {
    createdAt: {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    },
  }

  const [invoicesData, summaryInvoices, classesData] = await Promise.all([
    prisma.invoice.findMany({
      where: dateFilter,
      include: { student: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.findMany({
      where: dateFilter,
      select: { amount: true, status: true },
    }),
    // mirrors /api/classes GET for admin
    prisma.class.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Serialize dates to ISO strings for client component
  const invoices = invoicesData.map(inv => ({
    id: inv.id,
    description: inv.description,
    amount: inv.amount,
    dueDate: inv.dueDate.toISOString(),
    createdAt: inv.createdAt.toISOString(),
    status: inv.status as 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED',
    student: { name: inv.student.name },
  }))

  // Build summary (mirrors /api/admin/financial-report/summary logic)
  const summary = {
    total:     { count: summaryInvoices.length, amount: summaryInvoices.reduce((s, i) => s + i.amount, 0) },
    paid:      { count: summaryInvoices.filter(i => i.status === 'PAID').length,      amount: summaryInvoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0) },
    pending:   { count: summaryInvoices.filter(i => i.status === 'PENDING').length,   amount: summaryInvoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.amount, 0) },
    overdue:   { count: summaryInvoices.filter(i => i.status === 'OVERDUE').length,   amount: summaryInvoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.amount, 0) },
    cancelled: { count: summaryInvoices.filter(i => i.status === 'CANCELLED').length, amount: summaryInvoices.filter(i => i.status === 'CANCELLED').reduce((s, i) => s + i.amount, 0) },
  }

  return (
    <FinancialReportClient
      initialInvoices={invoices}
      initialSummary={summary}
      initialClassList={classesData}
      defaultMonth={defaultMonth}
      defaultYear={defaultYear}
    />
  )
}
