import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { formatRupiah } from '@/lib/utils'
import { Users, BookOpen, Calendar, CreditCard } from 'lucide-react'

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [totalStudents, totalClasses, schedulesToday, pendingInvoices, pendingTotal] = await Promise.all([
    prisma.student.count(),
    prisma.class.count(),
    prisma.schedule.count({
      where: { date: { gte: today, lt: tomorrow }, status: { in: ['PUBLISHED', 'COMPLETED'] } },
    }),
    prisma.invoice.findMany({
      where: { status: 'PENDING' },
      include: { student: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 5,
    }),
    prisma.invoice.aggregate({
      where: { status: 'PENDING' },
      _sum: { amount: true },
      _count: true,
    }),
  ])

  const stats = [
    { label: 'Total Siswa', value: totalStudents, icon: Users, color: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50', text: 'text-indigo-600' },
    { label: 'Total Kelas', value: totalClasses, icon: BookOpen, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-600' },
    { label: 'Jadwal Hari Ini', value: schedulesToday, icon: Calendar, color: 'from-amber-500 to-amber-600', bg: 'bg-amber-50', text: 'text-amber-600' },
    { label: 'Tagihan Pending', value: pendingTotal._count, icon: CreditCard, color: 'from-rose-500 to-rose-600', bg: 'bg-rose-50', text: 'text-rose-600' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-indigo-600 to-indigo-800 p-8 text-white shadow-xl shadow-indigo-600/10">
        <h1 className="text-3xl font-extrabold tracking-tight">Dashboard Admin 👋</h1>
        <p className="mt-2 text-indigo-100">Selamat datang! Berikut ringkasan operasional Mellyna Education hari ini.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-2xl bg-white p-6 shadow-xs border border-slate-100 flex items-center gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.bg}`}>
                <Icon className={`h-6 w-6 ${stat.text}`} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{stat.label}</p>
                <p className="mt-0.5 text-3xl font-extrabold text-slate-800">{stat.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pending Invoices */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">💳 Tagihan Belum Lunas</h2>
          <a href="/admin/billing" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Lihat Semua →</a>
        </div>
        {pendingInvoices.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <p className="text-3xl">🎉</p>
            <p className="mt-2 font-medium text-sm">Semua tagihan sudah lunas!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-semibold text-sm text-slate-800">{inv.student.name}</p>
                  <p className="text-xs text-slate-400">{inv.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-slate-800">{formatRupiah(inv.amount)}</p>
                  <p className="text-xs text-rose-500">Jatuh tempo: {new Date(inv.dueDate).toLocaleDateString('id-ID')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {pendingTotal._sum.amount && pendingTotal._sum.amount > 0 && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-between text-sm">
            <span className="text-slate-500 font-medium">Total Pending:</span>
            <span className="font-bold text-rose-600">{formatRupiah(pendingTotal._sum.amount!)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
