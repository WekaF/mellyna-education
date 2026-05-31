import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Download, FileText, CheckCircle2, Clock, Circle } from 'lucide-react'
import { ReportPeriodType } from '@prisma/client'

type MilestoneEntry = {
  id: string
  name: string
  description: string | null
  order: number
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  completedAt: string | null
}

type ProgramSnapshot = {
  program: string
  label: string
  completedCount: number
  inProgressCount: number
  notStartedCount: number
  totalCount: number
  percent: number
  milestones: MilestoneEntry[]
}

type SnapshotJson = { programs: ProgramSnapshot[] }
type SessionJson = { totalSessions: number; avgScore: number | null }

const PERIOD_LABELS: Record<ReportPeriodType, string> = {
  MONTHLY: 'Bulanan',
  SEMESTER: 'Per Semester',
  CUSTOM: 'Bebas',
}

const STATUS_CFG = {
  COMPLETED: { label: 'Selesai', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400', Icon: CheckCircle2 },
  IN_PROGRESS: { label: 'Berjalan', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400', Icon: Clock },
  NOT_STARTED: { label: 'Belum', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', Icon: Circle },
}

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

export default async function ParentMilestoneReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ reportId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as any).id
  const { reportId } = await searchParams

  const children = await prisma.student.findMany({
    where: { parentId: userId, isActive: true },
    select: { id: true },
  })
  const childIds = children.map((c) => c.id)

  const reports = await prisma.milestoneReport.findMany({
    where: { studentId: { in: childIds } },
    include: { student: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const activeReport = reportId
    ? reports.find((r) => r.id === reportId)
    : reports[0] ?? null

  if (reports.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-700 p-5 sm:p-8 text-white shadow-xl">
          <h1 className="text-xl sm:text-3xl font-extrabold">📋 Raport Milestone</h1>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-10 text-center text-slate-400">
          <p className="text-3xl">📋</p>
          <p className="mt-2 text-sm">Belum ada raport diterbitkan untuk anak Anda.</p>
        </div>
      </div>
    )
  }

  const snapshot = activeReport
    ? (activeReport.snapshotJson as unknown as SnapshotJson)
    : null
  const sessionData = activeReport
    ? (activeReport.sessionSummary as unknown as SessionJson)
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-700 p-5 sm:p-8 text-white shadow-xl">
        <h1 className="text-xl sm:text-3xl font-extrabold">📋 Raport Milestone</h1>
        <p className="mt-2 text-sm text-violet-100">Riwayat raport perkembangan belajar anak Anda.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report list sidebar */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden lg:col-span-1">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-bold text-slate-800 dark:text-white text-sm">Daftar Raport</h2>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {reports.map((r) => (
              <li key={r.id}>
                <a
                  href={`/parent/milestone-reports?reportId=${r.id}`}
                  className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                    activeReport?.id === r.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <FileText
                    className={`h-4 w-4 shrink-0 ${activeReport?.id === r.id ? 'text-indigo-600' : 'text-slate-400'}`}
                  />
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${activeReport?.id === r.id ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-800 dark:text-white'}`}>
                      {r.student.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{r.periodLabel}</p>
                    <p className="text-xs text-slate-400">{fmtDate(r.createdAt)}</p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Report detail */}
        {activeReport && snapshot && sessionData && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden lg:col-span-2">
            {/* Detail header */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-extrabold text-slate-800 dark:text-white">
                  {activeReport.student.name}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {activeReport.periodLabel} · {PERIOD_LABELS[activeReport.periodType]}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Diterbitkan {fmtDate(activeReport.createdAt)}
                </p>
              </div>
              <a
                href={`/api/milestone-reports/${activeReport.id}/pdf`}
                download
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors shrink-0"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Session summary */}
              {sessionData.totalSessions > 0 && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 flex gap-8">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      Total Sesi
                    </p>
                    <p className="text-2xl font-extrabold text-slate-800 dark:text-white mt-0.5">
                      {sessionData.totalSessions}
                    </p>
                    <p className="text-xs text-slate-400">pertemuan</p>
                  </div>
                  {sessionData.avgScore !== null && (
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        Rata-rata Nilai
                      </p>
                      <p className="text-2xl font-extrabold text-indigo-600 mt-0.5">
                        {sessionData.avgScore}
                      </p>
                      <p className="text-xs text-slate-400">dari 100</p>
                    </div>
                  )}
                </div>
              )}

              {/* Programs */}
              {snapshot.programs.map((prog) => (
                <div key={prog.program} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                      {prog.label}
                    </h3>
                    <span className="text-xs text-slate-400">
                      {prog.completedCount}/{prog.totalCount} selesai
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                      style={{ width: `${prog.percent}%` }}
                    />
                  </div>
                  {/* Milestone list */}
                  <div className="space-y-1.5">
                    {prog.milestones.map((m, idx) => {
                      const cfg = STATUS_CFG[m.status]
                      const Icon = cfg.Icon
                      return (
                        <div key={m.id} className="flex items-start gap-3">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-semibold ${
                                m.status === 'COMPLETED'
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-800 dark:text-white'
                              }`}
                            >
                              {m.name}
                            </p>
                            {m.completedAt && (
                              <p className="text-xs text-emerald-500">✓ {fmtDate(m.completedAt)}</p>
                            )}
                          </div>
                          <span
                            className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${cfg.cls}`}
                          >
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Notes */}
              {activeReport.notes && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Catatan
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{activeReport.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
