import { prisma } from '@/lib/db'

export default async function AnnouncementsWidget() {
  const announcements = await prisma.announcement.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
  })

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">📢 Pengumuman</h2>
      {announcements.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 p-8 text-center text-slate-400 dark:text-slate-500">
          <p className="text-2xl">📭</p>
          <p className="mt-2 text-sm">Belum ada pengumuman.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <div
              key={ann.id}
              className="rounded-2xl bg-white dark:bg-[#1e293b]/45 border border-slate-100 dark:border-slate-800/60 shadow-xs p-5"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">📌</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">{ann.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-3">{ann.content}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                    {new Date(ann.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
