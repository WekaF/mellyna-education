import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import ParentScheduleList from '@/components/dashboard/ParentScheduleList'

export default async function ParentSchedulePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id

  // Query all published schedules associated with the parent's children
  const schedules = (await prisma.schedule.findMany({
    where: {
      status: { in: ['PUBLISHED', 'COMPLETED'] },
      class: { enrollments: { some: { student: { parentId: userId } } } },
    },
    include: {
      class: {
        include: {
          tutor: { select: { name: true } },
          enrollments: { 
            where: { student: { parentId: userId } }, 
            include: { student: { select: { id: true, name: true } } } 
          },
        },
      },
      attendances: {
        where: { student: { parentId: userId } }
      },
      reports: {
        where: { student: { parentId: userId } },
        include: {
          tutor: { select: { name: true } },
          student: { select: { id: true, name: true } },
          media: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  })) as any[]

  // Separate schedules based on date (comparing with start of today)
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  
  const upcoming = schedules.filter((s) => new Date(s.date) >= startOfToday)
  const past = schedules.filter((s) => new Date(s.date) < startOfToday)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">📅 Kalender Kelas & Kehadiran Anak</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Pantau seluruh jadwal bimbingan belajar dan ajukan permohonan izin/sakit bila berhalangan hadir.
        </p>
      </div>

      <div className="space-y-8">
        {/* Section: Upcoming Schedules */}
        <div className="space-y-4">
          <h2 className="text-base font-extrabold text-slate-700 dark:text-slate-350 border-l-4 border-violet-500 pl-3">
            🗓️ Kelas Mendatang
          </h2>
          <ParentScheduleList schedules={upcoming} />
        </div>

        {/* Section: Past Schedules */}
        {past.length > 0 && (
          <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800/60">
            <h2 className="text-base font-extrabold text-slate-600 dark:text-slate-400 border-l-4 border-slate-400 pl-3">
              🕐 Kelas Sebelumnya
            </h2>
            <ParentScheduleList schedules={past} />
          </div>
        )}
      </div>
    </div>
  )
}
