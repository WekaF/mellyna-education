import { jsPDF } from 'jspdf'

export interface InvoiceData {
  id: string
  description: string
  amount: number
  dueDate: Date
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  paidAt: Date | null
  createdAt: Date
  student: {
    name: string
    grade: string | null
    parent: {
      name: string
      phone: string | null
      email: string
    }
  }
}

// ── Design tokens ──────────────────────────────────────────────
const C = {
  teal:      [13, 148, 136]   as [number, number, number],
  tealDark:  [19, 78, 74]     as [number, number, number],
  tealLight: [240, 253, 250]  as [number, number, number],
  tealMid:   [153, 246, 228]  as [number, number, number],
  navy:      [15, 23, 42]     as [number, number, number],
  slate:     [30, 41, 59]     as [number, number, number],
  gray:      [100, 116, 139]  as [number, number, number],
  light:     [248, 250, 252]  as [number, number, number],
  border:    [226, 232, 240]  as [number, number, number],
  white:     [255, 255, 255]  as [number, number, number],
}

const STATUS_LABELS: Record<string, string> = {
  PENDING:   'BELUM LUNAS',
  PAID:      'LUNAS',
  OVERDUE:   'TERLAMBAT',
  CANCELLED: 'DIBATALKAN',
}

const STATUS_COLORS: Record<string, { bg: [number,number,number]; text: [number,number,number]; bar: [number,number,number] }> = {
  PAID:      { bg: [209,250,229], text: [6,95,70],   bar: [16,185,129] },
  PENDING:   { bg: [254,243,199], text: [146,64,14],  bar: [245,158,11] },
  OVERDUE:   { bg: [254,226,226], text: [153,27,27],  bar: [239,68,68]  },
  CANCELLED: { bg: [241,245,249], text: [71,85,105],  bar: [148,163,184]},
}

function formatRp(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n)
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function invoiceNumber(invoice: InvoiceData): string {
  const y = invoice.createdAt.getFullYear()
  const m = String(invoice.createdAt.getMonth() + 1).padStart(2, '0')
  const suffix = invoice.id.slice(-6).toUpperCase()
  return `INV-${y}${m}-${suffix}`
}

function setFill(doc: jsPDF, color: [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2])
}

function setTextColor(doc: jsPDF, color: [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2])
}

function setDrawColor(doc: jsPDF, color: [number, number, number]) {
  doc.setDrawColor(color[0], color[1], color[2])
}

export function generateInvoicePdf(invoice: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })

      const W = 595.28
      const H = 841.89
      const ACC = 8   // left accent bar width
      const P = 38    // left content padding
      const R = W - 40 // right edge

      const sc = STATUS_COLORS[invoice.status] ?? STATUS_COLORS['PENDING']
      const invNo = invoiceNumber(invoice)

      // ── White background ─────────────────────────────────────
      setFill(doc, C.white)
      doc.rect(0, 0, W, H, 'F')

      // ── Left accent bar (full height) ─────────────────────────
      setFill(doc, C.teal)
      doc.rect(0, 0, ACC, H, 'F')

      // ── Teal header band ──────────────────────────────────────
      setFill(doc, C.teal)
      doc.rect(ACC, 0, W - ACC, 88, 'F')

      // Company name (white on teal)
      setTextColor(doc, C.white)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(22)
      doc.text('MELLYNA EDUCATION', P, 40)

      setTextColor(doc, C.tealMid)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('Bimbingan Belajar & Kursus Sempoa  •  Yogyakarta', P, 60)

      // INVOICE label (right side of header)
      setTextColor(doc, C.white)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(30)
      doc.text('INVOICE', R, 38, { align: 'right' })

      setTextColor(doc, C.tealMid)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(`No. ${invNo}`, R, 58, { align: 'right' })

      // ── Status colour stripe (8px, just below header) ─────────
      setFill(doc, sc.bar)
      doc.rect(ACC, 88, W - ACC, 8, 'F')

      // ── Two-column meta section (y = 108 to ~205) ──────────────
      const metaY = 108

      // Left — Bill To
      setTextColor(doc, C.gray)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('TAGIHAN KEPADA', P, metaY + 8)

      setTextColor(doc, C.navy)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(invoice.student.parent.name, P, metaY + 24)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      setTextColor(doc, C.gray)
      let infoY = metaY + 42
      if (invoice.student.parent.phone) {
        doc.text(`HP: ${invoice.student.parent.phone}`, P, infoY)
        infoY += 14
      }
      doc.text(invoice.student.parent.email, P, infoY)
      infoY += 14
      const gradeStr = invoice.student.grade ? ` (${invoice.student.grade})` : ''
      doc.text(`Siswa: ${invoice.student.name}${gradeStr}`, P, infoY)

      // Right — Invoice detail box
      const boxX = W / 2 + 20
      const boxW = R - boxX
      setFill(doc, C.light)
      doc.rect(boxX, metaY, boxW, 90, 'F')

      setTextColor(doc, C.gray)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('DETAIL INVOICE', boxX + 12, metaY + 20)

      const detailRows: [string, string][] = [
        ['No. Invoice', invNo],
        ['Tanggal', formatDate(invoice.createdAt)],
        ['Jatuh Tempo', formatDate(invoice.dueDate)],
      ]
      if (invoice.paidAt) detailRows.push(['Tgl. Bayar', formatDate(invoice.paidAt)])

      detailRows.forEach(([label, value], i) => {
        const ry = metaY + 36 + i * 16
        setTextColor(doc, C.gray)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(label, boxX + 12, ry)
        setTextColor(doc, C.slate)
        doc.setFont('helvetica', 'bold')
        doc.text(value, boxX + boxW - 12, ry, { align: 'right' })
      })

      // ── Status badge ──────────────────────────────────────────
      const badgeY = 214
      setFill(doc, sc.bg)
      doc.rect(P, badgeY, 160, 30, 'F')
      setTextColor(doc, sc.text)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      const statusLabel = STATUS_LABELS[invoice.status] ?? invoice.status
      doc.text(statusLabel, P + 80, badgeY + 20, { align: 'center' })

      // ── Items table ───────────────────────────────────────────
      const tableY = 264

      // Table header (dark)
      setFill(doc, C.slate)
      doc.rect(P, tableY, R - P, 26, 'F')
      setTextColor(doc, C.white)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('KETERANGAN', P + 12, tableY + 17)
      doc.text('NOMINAL', R - 8, tableY + 17, { align: 'right' })

      // Data row (light)
      setFill(doc, C.light)
      doc.rect(P, tableY + 26, R - P, 40, 'F')
      setTextColor(doc, C.navy)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      // description with wrapping
      const maxDescW = R - P - 140
      const descLines = doc.splitTextToSize(invoice.description, maxDescW)
      doc.text(descLines, P + 12, tableY + 43)
      setTextColor(doc, C.slate)
      doc.setFont('helvetica', 'bold')
      doc.text(formatRp(invoice.amount), R - 8, tableY + 43, { align: 'right' })

      // Table bottom border
      setDrawColor(doc, C.border)
      doc.setLineWidth(1)
      doc.line(P, tableY + 66, R, tableY + 66)

      // ── Total box ─────────────────────────────────────────────
      const totalY = tableY + 80
      const totalBoxW = 230
      const totalBoxX = R - totalBoxW
      setFill(doc, C.tealLight)
      doc.rect(totalBoxX, totalY, totalBoxW, 46, 'F')
      setTextColor(doc, C.tealDark)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('TOTAL PEMBAYARAN', totalBoxX + 14, totalY + 18)
      setTextColor(doc, C.teal)
      doc.setFontSize(16)
      doc.text(formatRp(invoice.amount), totalBoxX + totalBoxW - 14, totalY + 38, { align: 'right' })

      // ── Payment note ──────────────────────────────────────────
      const noteY = totalY + 62
      setDrawColor(doc, C.border)
      doc.setLineWidth(0.5)
      doc.line(P, noteY, R, noteY)

      setTextColor(doc, C.gray)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('CARA PEMBAYARAN', P, noteY + 20)
      doc.setFont('helvetica', 'normal')
      const noteText =
        'Pembayaran dapat dilakukan melalui portal Mellyna Education (Midtrans) atau transfer bank. ' +
        'Hubungi admin untuk konfirmasi atau pertanyaan lebih lanjut.'
      const noteLines = doc.splitTextToSize(noteText, R - P)
      doc.text(noteLines, P, noteY + 34)

      // ── Footer ────────────────────────────────────────────────
      const footerY = H - 52
      setFill(doc, C.tealLight)
      doc.rect(ACC, footerY, W - ACC, 52, 'F')
      setFill(doc, C.teal)
      doc.rect(0, footerY, ACC, 52, 'F')

      setTextColor(doc, C.teal)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('MELLYNA EDUCATION', P, footerY + 22)

      setTextColor(doc, C.gray)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.text(
        `info@mellynaeducation.id  •  Yogyakarta, Indonesia  •  Diterbitkan otomatis ${formatDate(new Date())}`,
        P,
        footerY + 38,
      )

      // ── Output as Buffer ──────────────────────────────────────
      const uint8 = doc.output('arraybuffer')
      resolve(Buffer.from(uint8))
    } catch (e) {
      reject(e)
    }
  })
}
