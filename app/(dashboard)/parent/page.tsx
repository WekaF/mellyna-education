import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { formatRupiah } from '@/lib/utils'

export default async function ParentDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id

  const children = await prisma.student.findMany({
    where: { parentId: userId },
    include: {
      enrollments: { include: { class: { select: { name: true } } } },
      _count: { select: { reports: true, attendances: true } },
      invoices: { where: { status: 'PENDING' } },
    },
  })

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-violet-800 p-8 text-white shadow-xl shadow-violet-600/10">
        <h1 className="text-3xl font-extrabold tracking-tight">Dashboard Orang Tua 👋</h1>
        <p className="mt-2 text-violet-100">Pantau perkembangan belajar, jadwal, dan tagihan anak Anda.</p>
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">👶 Data Anak</h2>
        {children.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
            <p className="text-3xl">👶</p>
            <p className="mt-2 text-sm">Belum ada data anak yang terdaftar.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => {
              const pendingTotal = child.invoices.reduce((sum, inv) => sum + inv.amount, 0)
              return (
                <div key={child.id} className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-violet-100 flex items-center justify-center text-xl">👤</div>
                    <div>
                      <h3 className="font-bold text-slate-800">{child.name}</h3>
                      <p className="text-xs text-slate-400">{child.grade || 'Kelas tidak diketahui'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">Kelas Diikuti:</p>
                    {child.enrollments.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Belum enrolled ke kelas manapun.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {child.enrollments.map((e) => (
                          <span key={e.class.name} className="text-xs bg-violet-50 text-violet-700 font-semibold px-2 py-0.5 rounded-full">{e.class.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                    <div className="text-center">
                      <p className="text-xl font-bold text-slate-800">{child._count.reports}</p>
                      <p className="text-xs text-slate-400">Laporan</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-slate-800">{child._count.attendances}</p>
                      <p className="text-xs text-slate-400">Kehadiran</p>
                    </div>
                  </div>
                  {pendingTotal > 0 && (
                    <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 flex items-center justify-between">
                      <p className="text-xs text-rose-700 font-semibold">Tagihan Pending:</p>
                      <Link href="/parent/billing" className="text-xs font-bold text-rose-600 hover:underline">{formatRupiah(pendingTotal)}</Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
