import { prisma } from '@/lib/db'

/** "Coding Kids" -> "CODING_KIDS" */
export function toMainProgramCode(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export function sessionTopic(c: { mainProgram: string | null; programs: { program: string }[] }): string {
  const label = c.programs.length > 0 ? c.programs.map(p => p.program).join(' + ') : (c.mainProgram ?? 'Kelas')
  return `Sesi Belajar ${label} - Rutin`
}

/**
 * requested set   -> its code if it exists in MainProgram, else undefined (invalid).
 * requested empty -> first of `programs` registered as MainProgram, else null.
 */
export async function resolveMainProgram(
  requested: string | null | undefined,
  programs: string[],
): Promise<string | null | undefined> {
  if (requested) {
    const found = await prisma.mainProgram.findUnique({ where: { code: requested }, select: { code: true } })
    return found ? found.code : undefined
  }
  if (programs.length === 0) return null
  const rows = await prisma.mainProgram.findMany({ where: { code: { in: programs } }, select: { code: true } })
  const codes = rows.map(r => r.code)
  return programs.find(p => codes.includes(p)) ?? null
}
