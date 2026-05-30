import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

function formatDate(date: Date) {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getAttendanceBadge(status: string | undefined) {
  const map: Record<string, { label: string; classes: string }> = {
    PRESENT: { label: 'Hadir', classes: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20' },
    ABSENT: { label: 'Alpha', classes: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20' },
    SICK: { label: 'Sakit', classes: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20' },
    PERMISSION: { label: 'Izin', classes: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20' },
  }
  return (
    map[status ?? ''] ?? {
      label: 'Belum Tercatat',
      classes: 'bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800/40',
    }
  )
}

export default async function ParentHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const { studentId } = await searchParams

  const children = await prisma.student.findMany({
    where: { parentId: userId },
    select: { id: true, name: true },
  })

  if (studentId && !children.some((c) => c.id === studentId)) {
    redirect('/parent/history')
  }

  const schedules = await prisma.schedule.findMany({
    where: {
      status: { in: ['COMPLETED', 'PUBLISHED'] },
      date: { lte: new Date() },
      class: {
        enrollments: {
          some: { student: { parentId: userId, ...(studentId ? { id: studentId } : {}) } },
        },
      },
    },
    include: {
      class: {
        select: {
          name: true,
          tutor: { select: { name: true } },
          enrollments: {
            where: { student: { parentId: userId, ...(studentId ? { id: studentId } : {}) } },
            include: { student: { select: { id: true, name: true } } },
          },
        },
      },
      attendances: {
        where: { student: { parentId: userId, ...(studentId ? { id: studentId } : {}) } },
        include: { student: { select: { id: true, name: true } } },
      },
      reports: {
        where: { student: { parentId: userId, ...(studentId ? { id: studentId } : {}) } },
        include: {
          tutor: { select: { name: true } },
          student: { select: { id: true, name: true } },
          media: true,
        },
      },
    },
    orderBy: { date: 'desc' },
  })

  // Group by calendar date
  const grouped = new Map<string, typeof schedules>()
  for (const s of schedules) {
    const key = new Date(s.date).toDateString()
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(s)
  }
  const groupedEntries = Array.from(grouped.entries())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">📖 Riwayat Belajar Harian</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Rekam jejak kehadiran, materi, dan laporan tutor setiap harinya.
        </p>
      </div>

      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <a
            href="/parent/history"
            className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
              !studentId
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-500/40'
            }`}
          >
            Semua Anak
          </a>
          {children.map((c) => (
            <a
              key={c.id}
              href={`/parent/history?studentId=${c.id}`}
              className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${
                studentId === c.id
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-500/40'
              }`}
            >
              {c.name}
            </a>
          ))}
        </div>
      )}

      {groupedEntries.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 p-10 text-center text-slate-400 dark:text-slate-500">
          <p className="text-3xl">📭</p>
          <p className="mt-2 text-sm font-medium">Belum ada riwayat belajar.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline spine */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-violet-300 via-slate-200 to-transparent dark:from-violet-500/40 dark:via-slate-800/60 dark:to-transparent hidden sm:block" />

          <div className="space-y-8">
            {groupedEntries.map(([dateKey, daySchedules]) => {
              const date = new Date(dateKey)
              const isToday = dateKey === new Date().toDateString()

              return (
                <div key={dateKey} className="sm:pl-14 relative">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-0 top-1 h-8 w-8 rounded-full border-2 hidden sm:flex items-center justify-center text-xs font-bold select-none ${
                      isToday
                        ? 'bg-violet-600 border-violet-600 text-white'
                        : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {date.getDate()}
                  </div>

                  <div className="mb-3">
                    <h2 className={`text-sm font-extrabold ${isToday ? 'text-violet-600 dark:text-violet-400' : 'text-slate-600 dark:text-slate-400'}`}>
                      {isToday && '📍 Hari Ini — '}{formatDate(date)}
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {daySchedules.map((sched) => (
                      <div key={sched.id} className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 shadow-xs p-5 space-y-4">
                        {/* Class header */}
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">{sched.class.name}</h3>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              Tutor: {sched.class.tutor.name} · {sched.startTime}–{sched.endTime} WIB
                            </p>
                          </div>
                          {sched.topic && (
                            <span className="text-xs bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 font-semibold px-2.5 py-1 rounded-lg border border-violet-100 dark:border-violet-500/20 shrink-0">
                              📚 {sched.topic}
                            </span>
                          )}
                        </div>

                        {/* Per-student rows */}
                        {sched.class.enrollments.map(({ student }) => {
                          const att = sched.attendances.find((a) => a.studentId === student.id)
                          const report = sched.reports.find((r) => r.studentId === student.id)
                          const badge = getAttendanceBadge(att?.status)

                          return (
                            <div
                              key={student.id}
                              className="rounded-xl bg-slate-50/60 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800/40 p-4 space-y-3"
                            >
                              {/* Student + attendance */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center text-xs font-bold text-violet-700 dark:text-violet-400">
                                    {student.name.substring(0, 2).toUpperCase()}
                                  </div>
                                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{student.name}</span>
                                </div>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${badge.classes}`}>
                                  {badge.label}
                                </span>
                              </div>

                              {/* Report or placeholder */}
                              {report ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                      Laporan Tutor
                                    </p>
                                    {report.score !== null && (
                                      <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center">
                                        <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                                          {report.score}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                                    {report.content}
                                  </p>
                                  {report.media.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {report.media.map((m) =>
                                        m.type === 'PHOTO' ? (
                                          <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">
                                            <img
                                              src={m.url}
                                              alt={m.filename}
                                              className="h-16 w-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                                            />
                                          </a>
                                        ) : (
                                          <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer">
                                            <div className="h-16 w-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                                              <video
                                                src={m.url}
                                                preload="metadata"
                                                className="h-full w-full object-cover cursor-pointer"
                                                title={m.filename}
                                              />
                                            </div>
                                          </a>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                                  {att?.status === 'ABSENT' || att?.status === 'SICK' || att?.status === 'PERMISSION'
                                    ? 'Tidak hadir — laporan tidak diperlukan.'
                                    : 'Laporan belum tersedia.'}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
