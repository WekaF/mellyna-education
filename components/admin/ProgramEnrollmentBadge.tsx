import { PROGRAM_BADGE_COLORS, PROGRAM_SHORT_LABELS, type ProgramKey } from '@/lib/program-config'

interface ProgramEnrollmentBadgeProps {
  program?: string | null
}

export function ProgramEnrollmentBadge({ program }: ProgramEnrollmentBadgeProps) {
  if (!program) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        Belum ada program
      </span>
    )
  }

  const colors = PROGRAM_BADGE_COLORS[program as ProgramKey] ?? 'bg-gray-100 text-gray-800'
  const label = PROGRAM_SHORT_LABELS[program as ProgramKey] ?? program

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${colors}`}>
      {label}
    </span>
  )
}
