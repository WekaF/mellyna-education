'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, MessageCircle } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/common/DataTable'
import { formatRupiah } from '@/lib/utils'

interface Invoice {
  id: string
  description: string
  amount: number
  dueDate: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  student: { name: string }
}

const statusConfig = {
  PENDING: { label: 'Belum Lunas', color: 'bg-amber-100 text-amber-700' },
  PAID: { label: 'Lunas', color: 'bg-emerald-100 text-emerald-700' },
  OVERDUE: { label: 'Terlambat', color: 'bg-rose-100 text-rose-700' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-slate-100 text-slate-600' },
}

export default function AdminBillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ studentId: '', amount: '', description: '', dueDate: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [studentList, setStudentList] = useState<{ id: string; name: string; grade: string | null }[]>([])
  const [reminding, setReminding] = useState(false)
  const [remindResult, setRemindResult] = useState<{ sent: number; failed: number; skipped: number; total: number } | null>(null)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/invoices')
      setInvoices(await res.json())
    } catch {
      setError('Gagal memuat data tagihan.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStudentList = useCallback(async () => {
    try {
      const res = await fetch('/api/students')
      if (!res.ok) throw new Error()
      setStudentList(await res.json())
    } catch {
      console.error('Gagal memuat daftar siswa.')
    }
  }, [])

  const handleRemind = async () => {
    if (!confirm('Kirim pengingat WA ke semua orang tua dengan tagihan PENDING?')) return
    setReminding(true)
    setRemindResult(null)
    try {
      const res = await fetch('/api/admin/billing/remind', { method: 'POST' })
      if (!res.ok) throw new Error()
      setRemindResult(await res.json())
    } catch {
      setError('Gagal mengirim pengingat.')
    } finally {
      setReminding(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
    fetchStudentList()
  }, [fetchInvoices, fetchStudentList])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseInt(form.amount) }),
      })
      if (!res.ok) throw new Error('Gagal membuat invoice.')
      await fetchInvoices()
      setShowForm(false)
      setForm({ studentId: '', amount: '', description: '', dueDate: '' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const columns = useMemo<ColumnDef<Invoice>[]>(() => [
    {
      id: 'student',
      accessorFn: (row) => row.student.name,
      header: 'Siswa',
      cell: ({ getValue }) => (
        <span className="font-semibold text-slate-800">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Keterangan',
      cell: ({ getValue }) => <span className="text-slate-600">{getValue() as string}</span>,
    },
    {
      accessorKey: 'amount',
      header: 'Nominal',
      cell: ({ getValue }) => (
        <span className="font-bold text-slate-800">{formatRupiah(getValue() as number)}</span>
      ),
    },
    {
      id: 'dueDate',
      accessorFn: (row) => new Date(row.dueDate).toLocaleDateString('id-ID'),
      header: 'Jatuh Tempo',
      cell: ({ getValue }) => <span className="text-slate-500">{getValue() as string}</span>,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">💳 Tagihan & Invoice</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola tagihan bimbel dan pantau status pembayaran.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRemind}
            disabled={reminding}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <MessageCircle className="h-4 w-4" />
            {reminding ? 'Mengirim...' : 'Kirim Pengingat WA'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Buat Invoice
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">
          ⚠️ {error}
        </div>
      )}
      {remindResult && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700 flex items-center justify-between">
          <span>✅ Pengingat terkirim: <strong>{remindResult.sent}</strong> berhasil, {remindResult.failed} gagal, {remindResult.skipped} dilewati (tidak ada HP).</span>
          <button onClick={() => setRemindResult(null)} className="ml-3 text-emerald-500 hover:text-emerald-700 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6">
          <h2 className="font-bold text-slate-800 mb-4">Buat Invoice Baru</h2>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Siswa *</label>
              <select
                required
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
              >
                <option value="">Pilih Siswa</option>
                {studentList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.grade ? ` (${s.grade})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nominal (Rp) *</label>
              <input
                required
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="500000"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Keterangan *</label>
              <input
                required
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="mis. Biaya Bimbel Bulan Juni"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Jatuh Tempo *</label>
              <input
                required
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Buat Invoice'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={invoices}
          loading={loading}
          searchPlaceholder="Cari siswa, keterangan, status..."
          emptyMessage="Belum ada tagihan."
          emptyIcon="💰"
        />
      </div>
    </div>
  )
}
