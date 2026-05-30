import PDFDocument from 'pdfkit'

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
  teal:      '#0d9488',
  tealDark:  '#134e4a',
  tealLight: '#f0fdfa',
  tealMid:   '#99f6e4',
  navy:      '#0f172a',
  slate:     '#1e293b',
  gray:      '#64748b',
  light:     '#f8fafc',
  border:    '#e2e8f0',
  white:     '#ffffff',
} as const

const STATUS_LABELS: Record<string, string> = {
  PENDING:   'BELUM LUNAS',
  PAID:      'LUNAS',
  OVERDUE:   'TERLAMBAT',
  CANCELLED: 'DIBATALKAN',
}

const STATUS_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  PAID:      { bg: '#d1fae5', text: '#065f46', bar: '#10b981' },
  PENDING:   { bg: '#fef3c7', text: '#92400e', bar: '#f59e0b' },
  OVERDUE:   { bg: '#fee2e2', text: '#991b1b', bar: '#ef4444' },
  CANCELLED: { bg: '#f1f5f9', text: '#475569', bar: '#94a3b8' },
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

export function generateInvoicePdf(invoice: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = doc.page.width   // 595.28
    const H = doc.page.height  // 841.89
    const ACC = 8              // left accent bar width
    const P = 38               // left content padding
    const R = W - 40           // right edge
    const sc = STATUS_COLORS[invoice.status] ?? STATUS_COLORS['PENDING']
    const invNo = invoiceNumber(invoice)

    // ── White background ─────────────────────────────────────
    doc.rect(0, 0, W, H).fill(C.white)

    // ── Left accent bar (full height) ─────────────────────────
    doc.rect(0, 0, ACC, H).fill(C.teal)

    // ── Teal header band ──────────────────────────────────────
    doc.rect(ACC, 0, W - ACC, 88).fill(C.teal)

    // Company name (white on teal)
    doc
      .fill(C.white)
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('MELLYNA EDUCATION', P, 22)
    doc
      .fill(C.tealMid)
      .fontSize(9)
      .font('Helvetica')
      .text('Bimbingan Belajar & Kursus Sempoa  •  Yogyakarta', P, 52)

    // INVOICE label (right side of header)
    doc
      .fill(C.white)
      .fontSize(30)
      .font('Helvetica-Bold')
      .text('INVOICE', 0, 18, { width: R, align: 'right' })
    doc
      .fill(C.tealMid)
      .fontSize(9)
      .font('Helvetica')
      .text(`No. ${invNo}`, 0, 57, { width: R, align: 'right' })

    // ── Status colour stripe (8px, just below header) ─────────
    doc.rect(ACC, 88, W - ACC, 8).fill(sc.bar)

    // ── Two-column meta section (y = 110 to ~205) ─────────────
    const metaY = 108

    // Left — Bill To
    doc
      .fill(C.gray)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('TAGIHAN KEPADA', P, metaY)
    doc
      .fill(C.navy)
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(invoice.student.parent.name, P, metaY + 14)

    doc.fill(C.gray).fontSize(9).font('Helvetica')
    let infoY = metaY + 32
    if (invoice.student.parent.phone) {
      doc.text(`HP: ${invoice.student.parent.phone}`, P, infoY)
      infoY += 14
    }
    doc.text(invoice.student.parent.email, P, infoY)
    infoY += 14
    doc.text(
      `Siswa: ${invoice.student.name}${invoice.student.grade ? ` (${invoice.student.grade})` : ''}`,
      P,
      infoY
    )

    // Right — Invoice detail box (light background)
    const boxX = W / 2 + 20
    const boxW = R - boxX
    doc.rect(boxX, metaY, boxW, 90).fill(C.light)

    doc
      .fill(C.gray)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('DETAIL INVOICE', boxX + 12, metaY + 12)

    const detailRows: [string, string][] = [
      ['No. Invoice', invNo],
      ['Tanggal', formatDate(invoice.createdAt)],
      ['Jatuh Tempo', formatDate(invoice.dueDate)],
    ]
    if (invoice.paidAt) detailRows.push(['Tgl. Bayar', formatDate(invoice.paidAt)])

    detailRows.forEach(([label, value], i) => {
      const ry = metaY + 28 + i * 16
      doc.fill(C.gray).fontSize(8).font('Helvetica').text(label, boxX + 12, ry)
      doc
        .fill(C.slate)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(value, boxX + 12, ry, { width: boxW - 24, align: 'right' })
    })

    // ── Status badge ──────────────────────────────────────────
    const badgeY = 214
    doc.rect(P, badgeY, 160, 30).fill(sc.bg)
    doc
      .fill(sc.text)
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(STATUS_LABELS[invoice.status] ?? invoice.status, P, badgeY + 9, {
        width: 160,
        align: 'center',
      })

    // ── Items table ───────────────────────────────────────────
    const tableY = 264

    // Table header (dark)
    doc.rect(P, tableY, R - P, 26).fill(C.slate)
    doc.fill(C.white).fontSize(9).font('Helvetica-Bold')
    doc.text('KETERANGAN', P + 12, tableY + 9)
    doc.text('NOMINAL', 0, tableY + 9, { width: R - 8, align: 'right' })

    // Data row (light)
    doc.rect(P, tableY + 26, R - P, 40).fill(C.light)
    doc
      .fill(C.navy)
      .fontSize(9)
      .font('Helvetica')
      .text(invoice.description, P + 12, tableY + 37, { width: R - P - 130 })
    doc
      .fill(C.slate)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(formatRp(invoice.amount), 0, tableY + 37, { width: R - 8, align: 'right' })

    // Table bottom border
    doc
      .moveTo(P, tableY + 66)
      .lineTo(R, tableY + 66)
      .strokeColor(C.border)
      .lineWidth(1)
      .stroke()

    // ── Total box ─────────────────────────────────────────────
    const totalY = tableY + 80
    const totalBoxW = 230
    const totalBoxX = R - totalBoxW
    doc.rect(totalBoxX, totalY, totalBoxW, 46).fill(C.tealLight)
    doc
      .fill(C.tealDark)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('TOTAL PEMBAYARAN', totalBoxX + 14, totalY + 8)
    doc
      .fill(C.teal)
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(formatRp(invoice.amount), totalBoxX, totalY + 22, {
        width: totalBoxW - 14,
        align: 'right',
      })

    // ── Payment note ──────────────────────────────────────────
    const noteY = totalY + 62
    doc
      .moveTo(P, noteY)
      .lineTo(R, noteY)
      .strokeColor(C.border)
      .lineWidth(0.5)
      .stroke()

    doc
      .fill(C.gray)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('CARA PEMBAYARAN', P, noteY + 14)
    doc
      .fill(C.gray)
      .fontSize(8)
      .font('Helvetica')
      .text(
        'Pembayaran dapat dilakukan melalui portal Mellyna Education (Midtrans) atau transfer bank. ' +
        'Hubungi admin untuk konfirmasi atau pertanyaan lebih lanjut.',
        P,
        noteY + 28,
        { width: R - P }
      )

    // ── Footer ────────────────────────────────────────────────
    const footerY = H - 52
    doc.rect(ACC, footerY, W - ACC, 52).fill(C.tealLight)
    doc.rect(0, footerY, ACC, 52).fill(C.teal)
    doc
      .fill(C.teal)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('MELLYNA EDUCATION', P, footerY + 12)
    doc
      .fill(C.gray)
      .fontSize(7.5)
      .font('Helvetica')
      .text(
        `info@mellynaeducation.id  •  Yogyakarta, Indonesia  •  Diterbitkan otomatis ${formatDate(new Date())}`,
        P,
        footerY + 30,
        { width: R - P }
      )

    doc.end()
  })
}
