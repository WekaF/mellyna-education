import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Image from 'next/image'
import { StarRating } from '@/components/ui/star-rating'

export default async function ParentProgressPage({ searchParams }: { searchParams: Promise<{ studentId?: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const { studentId } = await searchParams

  // Get all children of this parent
  const children = await prisma.student.findMany({ where: { parentId: userId }, select: { id: true, name: true } })

  // Get reports filtered by parent's children (and optionally by studentId)
  const reports = await prisma.learningReport.findMany({
    where: {
      student: { parentId: userId },
      ...(studentId ? { studentId } : {}),
    },
    include: {
      student: { select: { name: true } },
      schedule: { include: { class: { select: { name: true } } } },
      tutor: { select: { name: true } },
      media: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-800">📈 Perkembangan Belajar Anak</h1>

      {/* Filter by child */}
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <a href="/parent/progress" className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${!studentId ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>Semua Anak</a>
          {children.map((c) => (
            <a key={c.id} href={`/parent/progress?studentId=${c.id}`} className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors ${studentId === c.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>{c.name}</a>
          ))}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
          <p className="text-3xl">📭</p>
          <p className="mt-2 text-sm">Belum ada laporan perkembangan belajar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-800">{report.student.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {report.schedule.class.name} • {new Date(report.schedule.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Tutor: {report.tutor.name}</p>
                </div>
                {report.score !== null && (
                  <div className="shrink-0">
                    <StarRating value={report.score} size="md" />
                  </div>
                )}
              </div>
              {report.schedule.topic && (
                <p className="text-sm text-indigo-700 font-medium">📚 Materi: {report.schedule.topic}</p>
              )}
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-xs font-semibold text-slate-500 mb-1">Catatan Tutor:</p>
                <p className="text-sm text-slate-700 whitespace-pre-line">{report.content}</p>
              </div>
              {report.media.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">Foto/Video Sesi Belajar:</p>
                  <div className="flex flex-wrap gap-3">
                    {report.media.map((m) => (
                      <div key={m.id} className="flex flex-col gap-1">
                        {m.type === 'PHOTO' ? (
                          <a href={m.url} target="_blank" rel="noopener noreferrer">
                            <div className="h-24 w-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                              <img src={m.url} alt={m.filename} className="h-full w-full object-cover" />
                            </div>
                          </a>
                        ) : (
                          <div className="space-y-1">
                            <video
                              src={m.url}
                              controls
                              preload="metadata"
                              className="rounded-xl border border-slate-200 bg-slate-100 w-full max-w-xs"
                              title={m.filename}
                            />
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                            >
                              🔗 Buka link video
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
