import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { formatRupiah } from '@/lib/utils'
import ParentScheduleList from '@/components/dashboard/ParentScheduleList'

export default async function ParentDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id

  // 1. Get all children of this parent
  const children = await prisma.student.findMany({
    where: { parentId: userId },
    include: {
      enrollments: { include: { class: { select: { name: true } } } },
      _count: { select: { reports: true, attendances: true } },
      invoices: { where: { status: 'PENDING' } },
    },
  })

  // 2. Get 4 upcoming published schedules for this parent's children
  const upcomingSchedules = (await prisma.schedule.findMany({
    where: {
      status: 'PUBLISHED',
      date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      class: { enrollments: { some: { student: { parentId: userId } } } }
    },
    include: {
      class: {
        select: {
          name: true,
          tutor: { select: { name: true } },
          enrollments: {
            where: { student: { parentId: userId } },
            include: { student: { select: { id: true, name: true } } }
          }
        }
      },
      attendances: {
        where: { student: { parentId: userId } }
      }
    },
    orderBy: { date: 'asc' },
    take: 4
  })) as any[]

  return (
    <div className="space-y-8">
      {/* Top Banner card */}
      <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-violet-800 p-5 sm:p-8 text-white shadow-xl shadow-violet-600/10 transition-shadow">
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">Dashboard Orang Tua 👋</h1>
        <p className="mt-2 text-sm sm:text-base text-violet-100">Pantau perkembangan belajar, jadwal, dan tagihan anak Anda.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left columns - Main Info */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Section: Data Anak */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">👶 Data Anak Anda</h2>
            {children.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 p-10 text-center text-slate-400 dark:text-slate-500">
                <p className="text-3xl">👶</p>
                <p className="mt-2 text-sm font-medium">Belum ada data anak yang terdaftar.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {children.map((child) => {
                  const pendingTotal = child.invoices.reduce((sum, inv) => sum + inv.amount, 0)
                  return (
                    <div key={child.id} className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 shadow-xs p-6 space-y-4 hover:shadow-md transition-all duration-300">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-violet-100 dark:bg-violet-550/15 flex items-center justify-center text-xl">👤</div>
                        <div>
                          <h3 className="font-bold text-slate-800 dark:text-white">{child.name}</h3>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{child.grade || 'Kelas tidak diketahui'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-450 font-medium mb-1.5">Kelas Diikuti:</p>
                        {child.enrollments.length === 0 ? (
                          <p className="text-xs text-slate-400 dark:text-slate-500 italic">Belum enrolled ke kelas manapun.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {child.enrollments.map((e) => (
                              <span key={e.class.name} className="text-[11px] bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 font-semibold px-2 py-0.5 rounded-full border border-violet-100/50 dark:border-violet-500/20">{e.class.name}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                        <div className="text-center">
                          <p className="text-xl font-extrabold text-slate-800 dark:text-white">{child._count.reports}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase">Laporan</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-extrabold text-slate-800 dark:text-white">{child._count.attendances}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase">Kehadiran</p>
                        </div>
                      </div>
                      {pendingTotal > 0 && (
                        <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 p-3 flex items-center justify-between">
                          <p className="text-xs text-rose-700 dark:text-rose-400 font-semibold">Tagihan Pending:</p>
                          <Link href="/parent/billing" className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline">{formatRupiah(pendingTotal)}</Link>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Section: Jadwal Belajar Mendatang */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">📅 Jadwal Kelas Mendatang</h2>
            <ParentScheduleList schedules={upcomingSchedules} />
          </div>

        </div>

        {/* Right column - Summary & Shortcuts */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 p-6 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-white uppercase tracking-wider">⚡ Navigasi Pintar</h3>
            <div className="grid gap-2">
              <Link href="/parent/progress" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-850 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-violet-300 dark:hover:border-violet-500/30 transition-all cursor-pointer">
                <span>📈 Perkembangan Belajar</span>
                <span>→</span>
              </Link>
              <Link href="/parent/schedule" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-850 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-violet-300 dark:hover:border-violet-500/30 transition-all cursor-pointer">
                <span>📅 Kalender Kelas Lengkap</span>
                <span>→</span>
              </Link>
              <Link href="/parent/billing" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-850 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-violet-300 dark:hover:border-violet-500/30 transition-all cursor-pointer">
                <span>💳 Tagihan & Pembayaran</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
