'use client'

import Link from 'next/link'
import { Users, TrendingUp, BookOpen } from 'lucide-react'
import {
  PROGRAMS,
  PROGRAM_LABELS,
  PROGRAM_SHORT_LABELS,
  PROGRAM_DESCRIPTIONS,
  PROGRAM_GRADIENTS,
  PROGRAM_ICONS,
  PROGRAM_BADGE_COLORS,
  type ProgramKey,
} from '@/lib/program-config'

interface ProgramsClientProps {
  stats: Record<ProgramKey, { activeStudents: number }>
}

export default function ProgramsClient({ stats }: ProgramsClientProps) {
  const totalActive = Object.values(stats).reduce((sum, s) => sum + s.activeStudents, 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-700 p-5 sm:p-8 text-white shadow-xl shadow-violet-600/10">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-violet-200 text-xs font-bold uppercase tracking-widest mb-1">
              <BookOpen className="h-4 w-4" /> Master Data
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Program Belajar</h1>
            <p className="mt-1.5 text-sm text-violet-100">
              Daftar semua program yang tersedia di lembaga ini.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 rounded-2xl px-5 py-3">
            <Users className="h-6 w-6 text-violet-200 shrink-0" />
            <div>
              <p className="text-2xl font-extrabold">{totalActive}</p>
              <p className="text-xs text-violet-200">Siswa Aktif Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Program Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROGRAMS.map((program) => {
          const count = stats[program]?.activeStudents ?? 0
          return (
            <div
              key={program}
              className="group rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden"
            >
              {/* Card color bar */}
              <div className={`h-1.5 w-full bg-gradient-to-r ${PROGRAM_GRADIENTS[program]}`} />

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${PROGRAM_GRADIENTS[program]} flex items-center justify-center text-2xl shadow-sm shrink-0`}>
                    {PROGRAM_ICONS[program]}
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${PROGRAM_BADGE_COLORS[program]}`}>
                    <Users className="h-3 w-3" />
                    {count} siswa aktif
                  </span>
                </div>

                <div className="mt-3">
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-base leading-tight">
                    {PROGRAM_SHORT_LABELS[program]}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    {PROGRAM_LABELS[program]}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 leading-relaxed line-clamp-2">
                    {PROGRAM_DESCRIPTIONS[program]}
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Link
                    href={`/admin/parents?program=${program}`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Lihat Siswa
                  </Link>
                  <Link
                    href={`/admin/milestones/progress?program=${program}`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    Progress
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Info note */}
      <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-500 dark:text-slate-400">
        <strong className="text-slate-700 dark:text-slate-300">Catatan:</strong> Daftar program ini bersifat tetap dan dikonfigurasi oleh sistem. Untuk mendaftarkan siswa ke program, buka halaman{' '}
        <Link href="/admin/parents" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Wali Murid</Link>.
      </div>
    </div>
  )
}
