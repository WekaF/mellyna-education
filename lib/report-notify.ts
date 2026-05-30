import { sendWhatsApp } from '@/lib/waha'

export interface ParentReportData {
  parentPhone: string
  parentName: string
  studentName: string
  className: string
  scheduleDate: Date
  topic: string | null
  score: number | null
  content: string
}

const fmtDateLong = (d: Date) =>
  new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)

const fmtDateShort = (d: Date) =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)

export async function notifyParentNewReport(data: ParentReportData): Promise<boolean> {
  const lines = [
    `Assalamualaikum Bunda/Ayah *${data.parentName}*,`,
    ``,
    `Laporan belajar *${data.studentName}* telah dibuat oleh tutor.`,
    ``,
    `📚 Kelas: ${data.className}`,
    `📅 Tanggal: ${fmtDateLong(data.scheduleDate)}`,
  ]
  if (data.topic) lines.push(`📖 Materi: ${data.topic}`)
  if (data.score !== null) lines.push(`⭐ Nilai: ${data.score}/100`)
  lines.push(``, `💬 *Catatan Tutor:*`, data.content, ``, `Terima kasih,`, `Mellyna Education`)
  return sendWhatsApp(data.parentPhone, lines.join('\n'))
}

export interface DigestReportItem {
  studentName: string
  className: string
  score: number | null
  content: string
  tutorName: string
}

export function buildParentWeeklyDigestMessage(
  parentName: string,
  weekStart: Date,
  weekEnd: Date,
  reports: DigestReportItem[]
): string {
  const lines = [
    `Halo Bunda/Ayah *${parentName}*,`,
    ``,
    `Berikut ringkasan laporan belajar minggu ${fmtDateShort(weekStart)} – ${fmtDateShort(weekEnd)}:`,
    ``,
  ]
  for (const r of reports) {
    lines.push(`👤 *${r.studentName}* — ${r.className}`)
    if (r.score !== null) lines.push(`   ⭐ Nilai: ${r.score}/100`)
    const preview = r.content.length > 120 ? r.content.slice(0, 120) + '…' : r.content
    lines.push(`   📝 ${preview}`, ``)
  }
  lines.push(`Pantau perkembangan lengkap di portal Mellyna Education.`)
  lines.push(`Terima kasih,\nMellyna Education`)
  return lines.join('\n')
}

export interface AdminDigestItem {
  studentName: string
  className: string
  tutorName: string
  score: number | null
}

export function buildAdminDailyDigestMessage(date: Date, reports: AdminDigestItem[]): string {
  const lines = [
    `📊 *Ringkasan Laporan Harian*`,
    `Tanggal: ${fmtDateLong(date)}`,
    `Total laporan: *${reports.length}*`,
    ``,
  ]
  const byClass: Record<string, AdminDigestItem[]> = {}
  for (const r of reports) {
    if (!byClass[r.className]) byClass[r.className] = []
    byClass[r.className].push(r)
  }
  for (const [cn, reps] of Object.entries(byClass)) {
    lines.push(`📚 *${cn}* (${reps.length} siswa)`)
    for (const r of reps) {
      const s = r.score !== null ? ` | Nilai: ${r.score}` : ''
      lines.push(`  • ${r.studentName}${s}`)
    }
    lines.push(``)
  }
  lines.push(`— Mellyna Education`)
  return lines.join('\n')
}
