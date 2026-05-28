import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

export default async function ParentSchedulePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id

  const schedules = await prisma.schedule.findMany({
    where: {
      status: 'PUBLISHED',
      class: { enrollments: { some: { student: { parentId: userId } } } },
    },
    include: {
      class: {
        include: {
          tutor: { select: { name: true } },
          enrollments: { where: { student: { parentId: userId } }, include: { student: { select: { name: true } } } },
        },
      },
    },
    orderBy: { date: 'asc' },
  })

  const upcoming = schedules.filter((s) => new Date(s.date) >= new Date())
  const past = schedules.filter((s) => new Date(s.date) < new Date())

  const ScheduleList = ({ items, title }: { items: typeof schedules; title: string }) => (
    <div>
      <h2 className="text-base font-bold text-slate-700 mb-3">{title}</h2>
      {items.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-8 text-center text-slate-400">
          <p className="text-sm">Tidak ada jadwal.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <div key={s.id} className="rounded-2xl bg-white border border-slate-100 shadow-xs p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-800">{s.class.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(s.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • {s.startTime}–{s.endTime}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Tutor: {s.class.tutor.name}</p>
                  {s.location && <p className="text-xs text-slate-400">Lokasi: {s.location}</p>}
                </div>
                {s.topic && (
                  <span className="inline-block text-xs bg-indigo-50 text-indigo-700 font-semibold px-3 py-1 rounded-xl border border-indigo-100">
                    📚 {s.topic}
                  </span>
                )}
              </div>
              {s.class.enrollments.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mr-1">Anak:</p>
                  {s.class.enrollments.map((e) => (
                    <span key={e.student.name} className="text-xs bg-violet-50 text-violet-700 font-semibold px-2 py-0.5 rounded-full">{e.student.name}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-extrabold text-slate-800">📅 Jadwal Kelas Anak</h1>
      <ScheduleList items={upcoming} title="🗓️ Jadwal Mendatang" />
      {past.length > 0 && <ScheduleList items={past} title="🕐 Jadwal Sebelumnya" />}
    </div>
  )
}
