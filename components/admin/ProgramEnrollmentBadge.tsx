const PROGRAM_COLORS: Record<string, string> = {
  SEMPOA:    'bg-purple-100 text-purple-800',
  AHE:       'bg-blue-100 text-blue-800',
  EFK:       'bg-green-100 text-green-800',
  EYL:       'bg-teal-100 text-teal-800',
  EFE:       'bg-cyan-100 text-cyan-800',
  CALISTUNG: 'bg-orange-100 text-orange-800',
  ENGLISH:   'bg-indigo-100 text-indigo-800',
}

interface ProgramEnrollmentBadgeProps {
  program?: string | null
}

export function ProgramEnrollmentBadge({ program }: ProgramEnrollmentBadgeProps) {
  if (!program) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
        Belum ada program
      </span>
    )
  }

  const color = PROGRAM_COLORS[program] ?? 'bg-gray-100 text-gray-800'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {program}
    </span>
  )
}
