import { sendWhatsApp, sendWhatsAppFile } from '@/lib/waha'

export interface MilestoneReportNotifyData {
  parentPhone: string
  parentName: string
  studentName: string
  periodLabel: string
  snapshotSummary: Array<{
    label: string
    percent: number
    completedCount: number
    totalCount: number
  }>
  avgScore: number | null
  totalSessions: number
  notes: string | null
  pdfBuffer: ArrayBuffer
  pdfFilename: string
}

export async function notifyParentMilestoneReport(
  data: MilestoneReportNotifyData
): Promise<boolean> {
  const lines = [
    `Assalamualaikum Bunda/Ayah *${data.parentName}*,`,
    ``,
    `📋 *Raport Perkembangan Belajar ${data.studentName}* telah diterbitkan.`,
    `📅 Periode: *${data.periodLabel}*`,
    ``,
  ]

  for (const p of data.snapshotSummary) {
    if (p.totalCount === 0) continue
    lines.push(
      `📚 *${p.label}*: ${p.completedCount}/${p.totalCount} milestone selesai (${p.percent}%)`
    )
  }

  if (data.totalSessions > 0) {
    lines.push(``)
    lines.push(`📊 Total sesi: ${data.totalSessions} pertemuan`)
    if (data.avgScore !== null) {
      lines.push(`⭐ Rata-rata nilai: ${data.avgScore}/100`)
    }
  }

  if (data.notes) {
    lines.push(``, `💬 *Catatan:*`, data.notes)
  }

  lines.push(
    ``,
    `Raport lengkap terlampir dalam file PDF.`,
    ``,
    `Terima kasih,\nMellyna Education`
  )

  const message = lines.join('\n')
  const textSent = await sendWhatsApp(data.parentPhone, message)

  const base64 = Buffer.from(data.pdfBuffer).toString('base64')
  const fileSent = await sendWhatsAppFile(
    data.parentPhone,
    base64,
    data.pdfFilename,
    'application/pdf',
    `Raport ${data.studentName} — ${data.periodLabel}`
  )

  return textSent && fileSent.ok
}
