import PDFDocument from 'pdfkit'

export interface InvoiceData {
  id: string
  description: string
  amount: number
  dueDate: Date
  status: string
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

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'BELUM LUNAS',
  PAID: 'LUNAS',
  OVERDUE: 'TERLAMBAT',
  CANCELLED: 'DIBATALKAN',
}

function formatRp(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}

function invoiceNumber(invoice: InvoiceData): string {
  const y = invoice.createdAt.getFullYear()
  const m = String(invoice.createdAt.getMonth() + 1).padStart(2, '0')
  const suffix = invoice.id.slice(-6).toUpperCase()
  return `INV-${y}${m}-${suffix}`
}

export function generateInvoicePdf(invoice: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageW = doc.page.width
    const invNo = invoiceNumber(invoice)

    // ── Header band ──────────────────────────────────────────────
    doc.rect(0, 0, pageW, 100).fill('#3730a3')
    doc
      .fill('#ffffff')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('MELLYNA EDUCATION', 50, 28)
    doc
      .fontSize(9)
      .font('Helvetica')
      .text('Bimbingan Belajar & Kursus Sempoa  •  info@mellynaeducation.id', 50, 58)
      .text('Yogyakarta, Indonesia', 50, 72)

    // ── Invoice meta (left) ───────────────────────────────────────
    doc.fill('#1e293b').fontSize(20).font('Helvetica-Bold').text('INVOICE', 50, 122)
    doc.fontSize(9).font('Helvetica').fill('#64748b')
    doc.text(`No. Invoice   : ${invNo}`, 50, 150)
    doc.text(`Tanggal       : ${formatDate(invoice.createdAt)}`, 50, 164)
    doc.text(`Jatuh Tempo   : ${formatDate(invoice.dueDate)}`, 50, 178)

    // ── Billed to (right) ─────────────────────────────────────────
    doc.fill('#374151').fontSize(9).font('Helvetica-Bold').text('TAGIHAN KEPADA:', 360, 122)
    doc.fill('#1e293b').fontSize(9).font('Helvetica')
    doc.text(invoice.student.parent.name, 360, 138, { width: 180 })
    if (invoice.student.parent.phone) doc.text(`HP: ${invoice.student.parent.phone}`, 360, 152)
    doc.text(invoice.student.parent.email, 360, 166, { width: 180 })
    doc.text(
      `Siswa: ${invoice.student.name}${invoice.student.grade ? ` (${invoice.student.grade})` : ''}`,
      360, 180, { width: 180 }
    )

    // ── Divider ───────────────────────────────────────────────────
    doc.moveTo(50, 210).lineTo(pageW - 50, 210).strokeColor('#e2e8f0').stroke()

    // ── Table header ──────────────────────────────────────────────
    doc.rect(50, 220, pageW - 100, 22).fill('#f1f5f9')
    doc.fill('#374151').fontSize(9).font('Helvetica-Bold')
    doc.text('KETERANGAN', 62, 228)
    doc.text('JUMLAH', pageW - 160, 228, { width: 110, align: 'right' })

    // ── Table row ─────────────────────────────────────────────────
    doc.rect(50, 242, pageW - 100, 30).strokeColor('#e2e8f0').stroke()
    doc.fill('#1e293b').fontSize(9).font('Helvetica')
    doc.text(invoice.description, 62, 252, { width: 370 })
    doc.text(formatRp(invoice.amount), pageW - 160, 252, { width: 110, align: 'right' })

    // ── Total row ─────────────────────────────────────────────────
    doc.moveTo(50, 286).lineTo(pageW - 50, 286).strokeColor('#cbd5e1').stroke()
    doc.rect(pageW - 210, 290, 160, 24).fill('#f8fafc')
    doc.fill('#1e293b').fontSize(10).font('Helvetica-Bold')
    doc.text('TOTAL:', pageW - 205, 297)
    doc.text(formatRp(invoice.amount), pageW - 160, 297, { width: 110, align: 'right' })

    // ── Status badge ──────────────────────────────────────────────
    const statusColors: Record<string, { bg: string; text: string }> = {
      PAID:      { bg: '#d1fae5', text: '#065f46' },
      PENDING:   { bg: '#fef3c7', text: '#92400e' },
      OVERDUE:   { bg: '#fee2e2', text: '#991b1b' },
      CANCELLED: { bg: '#f1f5f9', text: '#475569' },
    }
    const sc = statusColors[invoice.status] ?? statusColors['PENDING']
    const label = STATUS_LABELS[invoice.status] ?? invoice.status
    doc.rect(50, 334, 160, 28).fill(sc.bg)
    doc.fill(sc.text).fontSize(12).font('Helvetica-Bold').text(label, 58, 343)

    // ── Payment note ──────────────────────────────────────────────
    doc.fill('#64748b').fontSize(8).font('Helvetica').text(
      'Pembayaran dapat dilakukan melalui portal atau transfer ke rekening yang tertera. ' +
      'Hubungi admin jika ada pertanyaan.',
      50, 380, { width: pageW - 100 }
    )

    // ── Footer ────────────────────────────────────────────────────
    doc.moveTo(50, 755).lineTo(pageW - 50, 755).strokeColor('#e2e8f0').stroke()
    doc.fill('#94a3b8').fontSize(7).font('Helvetica').text(
      `Diterbitkan oleh Mellyna Education  •  ${formatDate(new Date())}  •  Dokumen ini dibuat secara otomatis`,
      50, 762, { align: 'center', width: pageW - 100 }
    )

    doc.end()
  })
}
