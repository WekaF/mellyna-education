import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { TutorLocationEdit } from '@/components/dashboard/TutorLocationEdit'
import AnnouncementsWidget from '@/components/dashboard/AnnouncementsWidget'

export default async function TutorDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id

  const schedules = await prisma.schedule.findMany({
    where: {
      OR: [
        { class: { tutorId: userId } },
        { class: { additionalTutors: { some: { tutorId: userId } } } },
      ],
      date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    include: {
      class: { select: { name: true, _count: { select: { enrollments: true } } } },
      _count: { select: { reports: true, participants: true } },
    },
    orderBy: { date: 'asc' },
  })

  const statusColor = {
    DRAFT: 'bg-slate-100 text-slate-600',
    PUBLISHED: 'bg-emerald-100 text-emerald-700',
    COMPLETED: 'bg-indigo-100 text-indigo-700',
    CANCELLED: 'bg-rose-100 text-rose-700',
  }

  const isNewlyPublished = (s: (typeof schedules)[0]) =>
    s.publishedAt !== null &&
    Date.now() - new Date(s.publishedAt).getTime() < 24 * 60 * 60 * 1000

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-emerald-800 p-8 text-white shadow-xl shadow-emerald-600/10">
        <h1 className="text-3xl font-extrabold tracking-tight">Dashboard Tutor 👋</h1>
        <p className="mt-2 text-emerald-100">Kelola jadwal mengajar, absensi siswa, dan laporan perkembangan belajar.</p>
      </div>

      <AnnouncementsWidget />

      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">📅 Jadwal Mengajar</h2>
        {schedules.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
            <p className="text-3xl">📭</p>
            <p className="mt-2 text-sm">Tidak ada jadwal mengajar dalam 7 hari terakhir.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="rounded-2xl bg-white border border-slate-100 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-slate-800">{schedule.class.name}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[schedule.status]}`}>
                      {schedule.status}
                    </span>
                    {isNewlyPublished(schedule) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 animate-pulse">
                        🆕 Baru
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {new Date(schedule.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • {schedule.startTime}–{schedule.endTime}
                  </p>
                  {schedule.topic && <p className="text-sm text-indigo-600 font-medium mt-0.5">📚 {schedule.topic}</p>}
                  <p className="text-xs text-slate-400 mt-1">{schedule.class._count.enrollments} siswa terdaftar</p>
                  <TutorLocationEdit scheduleId={schedule.id} location={schedule.location} />
                  {schedule._count.participants > 0 && (
                    <p className={`text-xs mt-1 font-medium ${schedule._count.reports >= schedule._count.participants ? 'text-emerald-600' : 'text-orange-500'}`}>
                      📝 {schedule._count.reports}/{schedule._count.participants} laporan diisi
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/tutor/attendance/${schedule.id}`}
                    className="text-sm font-semibold px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                  >
                    ✏️ Absensi
                  </Link>
                  <Link
                    href={`/tutor/reports/${schedule.id}`}
                    className="text-sm font-semibold px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    📝 Laporan
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
