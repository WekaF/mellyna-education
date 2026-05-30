import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import BillingClient from './BillingClient'

export default async function ParentBillingPage() {
  const session = await getSession()
  const userId = (session!.user as any).id

  const invoices = await prisma.invoice.findMany({
    where: { student: { parentId: userId } },
    include: {
      student: { select: { name: true } },
      payments: { select: { method: true, paidAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const serialized = invoices.map((inv) => ({
    ...inv,
    dueDate: inv.dueDate.toISOString(),
    paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    payments: inv.payments.map((p) => ({
      method: p.method,
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    })),
  }))

  return <BillingClient initialInvoices={serialized} />
}
