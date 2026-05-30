'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/common/DataTable'
import { formatRupiah } from '@/lib/utils'
import { exportToExcel, exportToPDF } from '@/lib/export'

interface Invoice {
  id: string
  description: string
  amount: number
  dueDate: string
  createdAt: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  student: { name: string }
}

interface Summary {
  total:     { count: number; amount: number }
  paid:      { count: number; amount: number }
  pending:   { count: number; amount: number }
  overdue:   { count: number; amount: number }
  cancelled: { count: number; amount: number }
}

const statusConfig = {
  PENDING:   { label: 'Belum Lunas', color: 'bg-amber-100 text-amber-700' },
  PAID:      { label: 'Lunas',       color: 'bg-emerald-100 text-emerald-700' },
  OVERDUE:   { label: 'Terlambat',   color: 'bg-rose-100 text-rose-700' },
  CANCELLED: { label: 'Dibatalkan',  color: 'bg-slate-100 text-slate-600' },
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)
const MONTHS = [
  { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' }, { value: '4', label: 'April' },
  { value: '5', label: 'Mei' }, { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' }, { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' }, { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
]

function SummaryCard({
  label, count, amount, colorClass,
}: { label: string; count: number; amount: number; colorClass: string }) {
  return (
    <div className={`rounded-2xl p-4 sm:p-5 border shadow-xs ${colorClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-base sm:text-2xl font-extrabold leading-tight">{formatRupiah(amount)}</p>
      <p className="text-xs mt-1 opacity-60">{count} invoice</p>
    </div>
  )
}

export default function FinancialReportPage() {
  const now = new Date()
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [classId, setClassId] = useState('')
  const [classList, setClassList] = useState<{ id: string; name: string }[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const buildParams = useCallback(() => {
    const p = new URLSearchParams({ month, year })
    if (classId) p.set('classId', classId)
    return p.toString()
  }, [month, year, classId])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const qs = buildParams()
    try {
      const [invRes, sumRes] = await Promise.all([
        fetch(`/api/invoices?${qs}`),
        fetch(`/api/admin/financial-report/summary?${qs}`),
      ])
      setInvoices(await invRes.json())
      setSummary(await sumRes.json())
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => {
    fetch('/api/classes').then(r => r.json()).then(setClassList).catch(() => {})
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const monthLabel = MONTHS.find(m => m.value === month)?.label ?? month

  const handleExportExcel = () => {
    const rows = invoices.map(inv => ({
      'Tanggal': new Date(inv.createdAt).toLocaleDateString('id-ID'),
      'Siswa': inv.student.name,
      'Keterangan': inv.description,
      'Nominal': inv.amount,
      'Jatuh Tempo': new Date(inv.dueDate).toLocaleDateString('id-ID'),
      'Status': statusConfig[inv.status].label,
    }))
    exportToExcel(rows, `Laporan-Keuangan-${monthLabel}-${year}`, 'Laporan Keuangan')
  }

  const handleExportPDF = async () => {
    setExporting(true)
    const cols = ['Tanggal', 'Siswa', 'Keterangan', 'Nominal', 'Jatuh Tempo', 'Status']
    const rows = invoices.map(inv => [
      new Date(inv.createdAt).toLocaleDateString('id-ID'),
      inv.student.name,
      inv.description,
      formatRupiah(inv.amount),
      new Date(inv.dueDate).toLocaleDateString('id-ID'),
      statusConfig[inv.status].label,
    ])
    await exportToPDF(cols, rows, `Laporan-Keuangan-${monthLabel}-${year}`, `Laporan Keuangan — ${monthLabel} ${year}`)
    setExporting(false)
  }

  const columns = useMemo<ColumnDef<Invoice>[]>(() => [
    {
      id: 'createdAt',
      accessorFn: row => new Date(row.createdAt).toLocaleDateString('id-ID'),
      header: 'Tanggal',
      cell: ({ getValue }) => <span className="text-slate-500 text-xs">{getValue() as string}</span>,
    },
    {
      id: 'student',
      accessorFn: row => row.student.name,
      header: 'Siswa',
      cell: ({ getValue }) => <span className="font-semibold text-slate-800">{getValue() as string}</span>,
    },
    {
      accessorKey: 'description',
      header: 'Keterangan',
      cell: ({ getValue }) => <span className="text-slate-600">{getValue() as string}</span>,
    },
    {
      accessorKey: 'amount',
      header: 'Nominal',
      cell: ({ getValue }) => <span className="font-bold text-slate-800">{formatRupiah(getValue() as number)}</span>,
    },
    {
      id: 'dueDate',
      accessorFn: row => new Date(row.dueDate).toLocaleDateString('id-ID'),
      header: 'Jatuh Tempo',
      cell: ({ getValue }) => <span className="text-slate-500 text-xs">{getValue() as string}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const cfg = statusConfig[getValue() as Invoice['status']]
        return (
          <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>
            {cfg.label}
          </span>
        )
      },
    },
  ], [])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">📊 Laporan Keuangan</h1>
          <p className="text-sm text-slate-500 mt-0.5">Rekap pendapatan bimbel per periode.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleExportExcel}
            disabled={loading || invoices.length === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            disabled={loading || invoices.length === 0 || exporting}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            {exporting ? 'Membuat PDF...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Bulan</label>
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white min-w-[130px]"
          >
            {MONTHS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tahun</label>
          <select
            value={year}
            onChange={e => setYear(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white min-w-[90px]"
          >
            {YEARS.map(y => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Kelas</label>
          <select
            value={classId}
            onChange={e => setClassId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white min-w-[160px]"
          >
            <option value="">Semua Kelas</option>
            {classList.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Tagihan"  count={summary.total.count}   amount={summary.total.amount}   colorClass="bg-slate-50 border-slate-200 text-slate-800" />
          <SummaryCard label="Terbayar"       count={summary.paid.count}    amount={summary.paid.amount}    colorClass="bg-emerald-50 border-emerald-100 text-emerald-800" />
          <SummaryCard label="Belum Lunas"    count={summary.pending.count} amount={summary.pending.amount} colorClass="bg-amber-50 border-amber-100 text-amber-800" />
          <SummaryCard label="Terlambat"      count={summary.overdue.count} amount={summary.overdue.amount} colorClass="bg-rose-50 border-rose-100 text-rose-800" />
        </div>
      )}

      {/* Data table */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={invoices}
          loading={loading}
          searchPlaceholder="Cari siswa, keterangan, status..."
          emptyMessage="Tidak ada tagihan pada periode ini."
          emptyIcon="📊"
        />
      </div>
    </div>
  )
}
