import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export type MilestoneEntry = {
  id: string
  name: string
  description: string | null
  order: number
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  completedAt: string | null
}

export type ProgramSnapshot = {
  program: string
  label: string
  completedCount: number
  inProgressCount: number
  notStartedCount: number
  totalCount: number
  percent: number
  milestones: MilestoneEntry[]
}

export type MilestoneSnapshotData = {
  programs: ProgramSnapshot[]
}

export type SessionSummaryData = {
  totalSessions: number
  avgScore: number | null
}

export type RaportData = {
  studentName: string
  periodLabel: string
  generatedAt: Date
  notes: string | null
  snapshot: MilestoneSnapshotData
  session: SessionSummaryData
}

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Selesai',
  IN_PROGRESS: 'Berjalan',
  NOT_STARTED: 'Belum Mulai',
}

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

export function generateRaportPdf(data: RaportData): ArrayBuffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  let y = 15

  // Header bar
  doc.setFillColor(99, 102, 241)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Raport Perkembangan Belajar', pageW / 2, 11, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Mellyna Education', pageW / 2, 18, { align: 'center' })
  doc.setFontSize(8)
  doc.text(`Diterbitkan: ${fmtDate(data.generatedAt)}`, pageW / 2, 24, { align: 'center' })

  y = 36
  doc.setTextColor(30, 30, 30)

  // Student info box
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, y, pageW - 28, 22, 3, 3, 'FD')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Nama Siswa', 20, y + 7)
  doc.text('Periode', 20, y + 14)
  doc.setFont('helvetica', 'normal')
  doc.text(`: ${data.studentName}`, 55, y + 7)
  doc.text(`: ${data.periodLabel}`, 55, y + 14)
  y += 30

  // Session summary
  if (data.session.totalSessions > 0) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(99, 102, 241)
    doc.text('RINGKASAN SESI', 14, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    const sessionText = [
      `Total sesi: ${data.session.totalSessions} pertemuan`,
      data.session.avgScore !== null ? `   |   Rata-rata nilai: ${data.session.avgScore}/100` : '',
    ].join('')
    doc.text(sessionText, 14, y)
    y += 10
  }

  // Per-program milestone tables
  for (const prog of data.snapshot.programs) {
    if (prog.totalCount === 0) continue

    // Program header
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(99, 102, 241)
    doc.text(`PROGRAM ${prog.label.toUpperCase()}`, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(
      `${prog.completedCount}/${prog.totalCount} selesai (${prog.percent}%)`,
      pageW - 14,
      y,
      { align: 'right' }
    )

    // Progress bar
    y += 3
    const barW = pageW - 28
    doc.setFillColor(226, 232, 240)
    doc.rect(14, y, barW, 3, 'F')
    if (prog.percent > 0) {
      doc.setFillColor(99, 102, 241)
      doc.rect(14, y, (barW * prog.percent) / 100, 3, 'F')
    }
    y += 7

    autoTable(doc, {
      startY: y,
      head: [['No', 'Milestone', 'Status', 'Tanggal Selesai']],
      body: prog.milestones.map((m, idx) => [
        String(idx + 1),
        m.name,
        STATUS_LABEL[m.status],
        m.completedAt ? fmtDate(m.completedAt) : '—',
      ]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        2: { cellWidth: 30 },
        3: { cellWidth: 38 },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const status = prog.milestones[hookData.row.index]?.status
          if (status === 'COMPLETED') hookData.cell.styles.textColor = [16, 185, 129]
          else if (status === 'IN_PROGRESS') hookData.cell.styles.textColor = [245, 158, 11]
          else hookData.cell.styles.textColor = [148, 163, 184]
        }
      },
      theme: 'grid',
    })

    y = (doc as any).lastAutoTable.finalY + 10

    if (y > 260) {
      doc.addPage()
      y = 20
    }
  }

  // Admin notes
  if (data.notes) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(99, 102, 241)
    doc.text('CATATAN', 14, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    const noteLines = doc.splitTextToSize(data.notes, pageW - 28)
    doc.text(noteLines, 14, y)
  }

  // Footer
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text(
    'Mellyna Education — Dokumen ini diterbitkan secara resmi oleh administrator.',
    pageW / 2,
    287,
    { align: 'center' }
  )

  return doc.output('arraybuffer')
}
