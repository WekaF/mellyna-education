import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import ExpensesClient from './ExpensesClient'

export default async function AdminExpensesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const role = (session.user as any).role
  if (role !== 'SUPER_ADMIN') redirect('/admin')

  const now = new Date()
  const defaultMonth = String(now.getMonth() + 1)
  const defaultYear = String(now.getFullYear())

  const [expensesData, categoriesData] = await Promise.all([
    prisma.expense.findMany({
      where: {
        date: {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
          lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    }),
    prisma.expenseCategory.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const expenses = expensesData.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    amount: e.amount,
    description: e.description,
    category: e.category,
  }))

  return (
    <ExpensesClient
      initialExpenses={expenses}
      initialCategories={categoriesData}
      defaultMonth={defaultMonth}
      defaultYear={defaultYear}
    />
  )
}
