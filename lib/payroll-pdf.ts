import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatRupiah } from '@/lib/utils'

export interface PayslipData {
  tutor: { name: string }
  periodMonth: string // "YYYY-MM"
  hariKerja: number
  dailyRateAmount: number
  izinHari: number
  bonusOntimeDays: number
  bonusOntimeAmount: number
  extraTimeHours: number
  extraTimeAmount: number
  extraHandleCount: number
  extraHandleAmount: number
  totalAmount: number
  status: 'DRAFT' | 'FINALIZED'
  generatedAt: Date
}

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function formatPeriodLabel(periodMonth: string): string {
  const [y, m] = periodMonth.split('-').map(Number)
  return `${BULAN_ID[m - 1]} ${y}`
}

function slug(s: string): string {
  return s.trim().replace(/\s+/g, '_').replace(/[^\w]/g, '')
}

export function formatPayslipFilename(entry: PayslipData): string {
  return `SLIP_GAJI_${slug(entry.tutor.name)}_${entry.periodMonth}`
}

export async function generatePayslipPdf(entry: PayslipData): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const P = 40

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(26, 86, 219)
  doc.text('Mellyna Education', P, 50)

  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text('SLIP GAJI', P, 75)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(80, 80, 80)
  doc.text(`Nama Tutor   : ${entry.tutor.name}`, P, 100)
  doc.text(`Periode      : ${formatPeriodLabel(entry.periodMonth)}`, P, 116)
  doc.text(`Status       : ${entry.status === 'FINALIZED' ? 'FINAL' : 'DRAFT'}`, P, 132)
  doc.text(
    `Dibuat       : ${entry.generatedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    P,
    148,
  )

  autoTable(doc, {
    startY: 170,
    head: [['Komponen', 'Jumlah', 'Nominal']],
    body: [
      ['Hari Kerja', `${entry.hariKerja} hari`, formatRupiah(entry.dailyRateAmount)],
      ['Bonus Ontime', `${entry.bonusOntimeDays} hari`, formatRupiah(entry.bonusOntimeAmount)],
      ['Extra Time (Lembur)', `${entry.extraTimeHours} jam`, formatRupiah(entry.extraTimeAmount)],
      ['Extra Handle', `${entry.extraHandleCount} sesi`, formatRupiah(entry.extraHandleAmount)],
      ['Izin (informasi, tidak dibayar)', `${entry.izinHari} hari`, '-'],
    ],
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [26, 86, 219], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
  })

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(26, 86, 219)
  doc.text('TOTAL GAJI', P, finalY + 30)
  doc.setFontSize(14)
  doc.text(formatRupiah(entry.totalAmount), 555 - P, finalY + 30, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(140, 140, 140)
  doc.text('Dokumen ini dibuat otomatis oleh sistem Mellyna Education.', P, finalY + 60)

  return doc.output('arraybuffer') as ArrayBuffer
}
