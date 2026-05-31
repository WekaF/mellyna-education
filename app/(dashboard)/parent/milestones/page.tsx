import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Program, MilestoneStatus } from '@prisma/client'

const PROGRAMS: Program[] = ['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH']
const PROGRAM_LABELS: Record<Program, string> = {
  SEMPOA: 'Sempoa', AHE: 'AHE', EFK: 'EFK', EYL: 'EYL', EFE: 'EFE', CALISTUNG: 'Calistung', ENGLISH: 'English',
}
const PROGRAM_COLORS: Record<Program, string> = {
  SEMPOA: 'from-indigo-500 to-indigo-600',
  AHE: 'from-emerald-500 to-emerald-600',
  EFK: 'from-amber-500 to-amber-600',
  EYL: 'from-rose-500 to-rose-600',
  EFE: 'from-cyan-500 to-cyan-600',
  CALISTUNG: 'from-violet-500 to-violet-600',
  ENGLISH: 'from-orange-500 to-orange-600',
}

const STATUS_BADGE: Record<MilestoneStatus, { label: string; class: string }> = {
  NOT_STARTED: { label: 'Belum Mulai', class: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  IN_PROGRESS: { label: 'Sedang Berjalan', class: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  COMPLETED: { label: 'Selesai', class: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
}

export default async function ParentMilestonesPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const { studentId } = await searchParams

  const children = await prisma.student.findMany({
    where: { parentId: userId, isActive: true },
    select: { id: true, name: true },
  })

  if (children.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">🎯 Milestone Belajar</h1>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 text-center text-slate-400">
          <p className="text-3xl">👶</p>
          <p className="mt-2 text-sm">Belum ada data anak terdaftar.</p>
        </div>
      </div>
    )
  }

  const activeChild = children.find((c) => c.id === studentId) ?? children[0]

  const milestones = await prisma.milestone.findMany({
    orderBy: [{ program: 'asc' }, { order: 'asc' }],
    include: {
      studentMilestones: {
        where: { studentId: activeChild.id },
      },
    },
  })

  // Group milestones by program, only show programs that have milestones defined
  const byProgram = PROGRAMS.reduce((acc, p) => {
    const pMilestones = milestones.filter((m) => m.program === p)
    if (pMilestones.length > 0) acc[p] = pMilestones
    return acc
  }, {} as Record<Program, typeof milestones>)

  const programsWithMilestones = Object.keys(byProgram) as Program[]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-700 p-5 sm:p-8 text-white shadow-xl shadow-violet-600/10">
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">🎯 Milestone Belajar</h1>
        <p className="mt-2 text-sm sm:text-base text-violet-100">
          Pantau pencapaian kurikulum {activeChild.name} secara terstruktur.
        </p>
      </div>

      {/* Child Selector */}
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((c) => (
            <a
              key={c.id}
              href={`/parent/milestones?studentId=${c.id}`}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                activeChild.id === c.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
              }`}
            >
              {c.name}
            </a>
          ))}
        </div>
      )}

      {programsWithMilestones.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 text-center text-slate-400">
          <p className="text-3xl">🎯</p>
          <p className="mt-2 text-sm">Belum ada milestone kurikulum yang didefinisikan.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {programsWithMilestones.map((program) => {
            const pMilestones = byProgram[program]
            const completed = pMilestones.filter(
              (m) => m.studentMilestones[0]?.status === 'COMPLETED'
            ).length
            const inProgress = pMilestones.filter(
              (m) => m.studentMilestones[0]?.status === 'IN_PROGRESS'
            ).length
            const percent = Math.round((completed / pMilestones.length) * 100)

            return (
              <div
                key={program}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden"
              >
                {/* Program Header */}
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${PROGRAM_COLORS[program]} text-white text-xs font-extrabold`}>
                        {PROGRAM_LABELS[program].substring(0, 2)}
                      </div>
                      <div>
                        <h2 className="font-extrabold text-slate-800 dark:text-white">{PROGRAM_LABELS[program]}</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {completed} selesai · {inProgress} berjalan · {pMilestones.length - completed - inProgress} belum mulai
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-2xl font-extrabold ${percent === 100 ? 'text-emerald-600' : percent > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {percent}%
                      </span>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full bg-gradient-to-r ${PROGRAM_COLORS[program]} transition-all duration-500`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Milestone List */}
                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {pMilestones.map((m, idx) => {
                    const sm = m.studentMilestones[0]
                    const status: MilestoneStatus = sm?.status ?? 'NOT_STARTED'
                    const badge = STATUS_BADGE[status]

                    return (
                      <div key={m.id} className="flex items-start gap-3 px-6 py-3.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-400 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${status === 'COMPLETED' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-white'}`}>
                            {m.name}
                          </p>
                          {m.description && (
                            <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>
                          )}
                          {sm?.completedAt && (
                            <p className="text-xs text-emerald-500 mt-0.5">
                              ✓ {new Date(sm.completedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${badge.class}`}>
                          {badge.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
