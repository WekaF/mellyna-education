import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendWhatsApp } from '@/lib/waha'
import { formatRupiah } from '@/lib/utils'

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const invoices = await prisma.invoice.findMany({
    where: { status: 'PENDING' },
    include: {
      student: {
        include: {
          parent: { select: { id: true, name: true, phone: true } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  })

  const byParent = new Map<string, { parent: { name: string; phone: string | null }, items: typeof invoices }>()
  for (const inv of invoices) {
    const parentId = inv.student.parent.id
    if (!byParent.has(parentId)) {
      byParent.set(parentId, { parent: inv.student.parent, items: [] })
    }
    byParent.get(parentId)!.items.push(inv)
  }

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const { parent, items } of byParent.values()) {
    if (!parent.phone) { skipped++; continue }

    const itemLines = items
      .map((inv) => `• ${inv.student.name}: ${formatRupiah(inv.amount)} (jatuh tempo ${new Date(inv.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })})`)
      .join('\n')

    const total = items.reduce((sum, inv) => sum + inv.amount, 0)

    const message = `Halo ${parent.name},

Ini adalah pengingat tagihan bimbingan belajar yang belum dibayar:

${itemLines}

Total: ${formatRupiah(total)}

Silakan lakukan pembayaran melalui portal atau hubungi kami jika ada pertanyaan.

Terima kasih,
Mellyna Education`

    const ok = await sendWhatsApp(parent.phone, message)
    if (ok) sent++; else failed++
  }

  return NextResponse.json({ sent, failed, skipped, total: byParent.size })
}
