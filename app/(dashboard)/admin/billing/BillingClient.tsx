'use client'

import { useState, useCallback, useMemo } from 'react'
import { Plus, MessageCircle, Users } from 'lucide-react'
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

interface BillingClientProps {
  initialInvoices: Invoice[]
  initialStudents: { id: string; name: string; grade: string | null }[]
  initialClasses: { id: string; name: string; tutor: { name: string } }[]
}

export default function BillingClient({ initialInvoices, initialStudents, initialClasses }: BillingClientProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ studentId: '', amount: '', description: '', dueDate: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [studentList, setStudentList] = useState<{ id: string; name: string; grade: string | null }[]>(initialStudents)
  const [reminding, setReminding] = useState(false)
  const [remindResult, setRemindResult] = useState<{ sent: number; failed: number; skipped: number; total: number } | null>(null)
  const [sendingWAId, setSendingWAId] = useState<string | null>(null)
  const [waFeedback, setWaFeedback] = useState<{ id: string; ok: boolean; msg: string } | null>(null)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [bulkForm, setBulkForm] = useState({ classId: '', amount: '', description: '', dueDate: '' })
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ created: number } | null>(null)
  const [classList, setClassList] = useState<{ id: string; name: string; tutor: { name: string } }[]>(initialClasses)
  const [manualPayModal, setManualPayModal] = useState<{ invoiceId: string; studentName: string; amount: number } | null>(null)
  const [manualMethod, setManualMethod] = useState<'CASH' | 'BRI_TRANSFER' | 'OTHER'>('CASH')
  const [manualNotes, setManualNotes] = useState('')
  const [manualSaving, setManualSaving] = useState(false)

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

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBulkSaving(true)
    setBulkResult(null)
    try {
      const res = await fetch('/api/invoices/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bulkForm, amount: parseInt(bulkForm.amount) }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal membuat invoice massal.')
      }
      const data = await res.json()
      setBulkResult(data)
      await fetchInvoices()
      setBulkForm({ classId: '', amount: '', description: '', dueDate: '' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBulkSaving(false)
    }
  }

  const handleDownloadPDF = useCallback((invoiceId: string) => {
    window.open(`/api/invoices/${invoiceId}/pdf`, '_blank')
  }, [])

  const handleSendWA = useCallback(async (invoiceId: string) => {
    setSendingWAId(invoiceId)
    setWaFeedback(null)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send-wa`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim')
      setWaFeedback({ id: invoiceId, ok: true, msg: `Invoice terkirim ke ${data.sentTo ?? 'penerima'}` })
    } catch (err: any) {
      setWaFeedback({ id: invoiceId, ok: false, msg: err.message })
    } finally {
      setSendingWAId(null)
    }
  }, [])

  const handleManualPay = async () => {
    if (!manualPayModal) return
    setError(null)
    setManualSaving(true)
    try {
      const res = await fetch('/api/payments/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: manualPayModal.invoiceId, method: manualMethod, notes: manualNotes }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal mencatat pembayaran.')
      }
      setManualPayModal(null)
      setManualNotes('')
      await fetchInvoices()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setManualSaving(false)
    }
  }

  const handleCancelInvoice = useCallback(async (id: string) => {
    if (!confirm('Batalkan invoice ini?')) return
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })
      if (!res.ok) throw new Error()
      await fetchInvoices()
    } catch {
      setError('Gagal membatalkan invoice.')
    }
  }, [fetchInvoices])

  const handleDeleteInvoice = useCallback(async (id: string) => {
    if (!confirm('Hapus invoice ini permanen? Tindakan tidak bisa dibatalkan.')) return
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      await fetchInvoices()
    } catch {
      setError('Gagal menghapus invoice.')
    }
  }, [fetchInvoices])

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
    {
      id: 'actions',
      header: 'Aksi',
      cell: ({ row }) => {
        const inv = row.original
        const sending = sendingWAId === inv.id
        return (
          <div className="flex items-center gap-1 flex-wrap">
            {(inv.status === 'PENDING' || inv.status === 'OVERDUE') && (
              <button
                onClick={() => setManualPayModal({ invoiceId: inv.id, studentName: inv.student.name, amount: inv.amount })}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
              >
                Tandai Lunas
              </button>
            )}
            {inv.status === 'PENDING' && (
              <button
                onClick={() => handleCancelInvoice(inv.id)}
                className="text-xs font-semibold text-amber-600 hover:text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
            {inv.status !== 'PAID' && (
              <button
                onClick={() => handleDeleteInvoice(inv.id)}
                className="text-xs font-semibold text-rose-500 hover:text-rose-700 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
              >
                Hapus
              </button>
            )}
            <button
              onClick={() => handleDownloadPDF(inv.id)}
              title="Download PDF"
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            >
              PDF
            </button>
            <button
              onClick={() => handleSendWA(inv.id)}
              disabled={sending}
              title="Kirim Invoice via WhatsApp"
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {sending ? '...' : 'WA'}
            </button>
          </div>
        )
      },
    },
  ], [handleCancelInvoice, handleDeleteInvoice, handleDownloadPDF, handleSendWA, sendingWAId])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">💳 Tagihan & Invoice</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola tagihan bimbel dan pantau status pembayaran.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleRemind}
            disabled={reminding}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <MessageCircle className="h-4 w-4" />
            {reminding ? 'Mengirim...' : 'Kirim Pengingat WA'}
          </button>
          <button
            onClick={() => { setShowBulkForm(true); setBulkResult(null) }}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Users className="h-4 w-4" /> Invoice Massal
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
      {waFeedback && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-center justify-between ${
          waFeedback.ok
            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
            : 'bg-rose-50 border-rose-100 text-rose-600'
        }`}>
          <span>{waFeedback.ok ? '✅' : '⚠️'} {waFeedback.msg}</span>
          <button onClick={() => setWaFeedback(null)} className="ml-3 font-bold cursor-pointer opacity-60 hover:opacity-100">✕</button>
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

      {showBulkForm && (
        <div className="rounded-2xl bg-white border border-violet-100 shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">📦 Invoice Massal — Per Kelas</h2>
            <button onClick={() => setShowBulkForm(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
          </div>
          {bulkResult && (
            <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
              ✅ Berhasil membuat <strong>{bulkResult.created}</strong> invoice untuk siswa aktif di kelas ini.
            </div>
          )}
          <form onSubmit={handleBulkSubmit} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kelas *</label>
              <select required value={bulkForm.classId} onChange={(e) => setBulkForm({ ...bulkForm, classId: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-violet-500 bg-white">
                <option value="">Pilih Kelas</option>
                {classList.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} (Tutor: {c.tutor.name})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nominal (Rp) *</label>
              <input required type="number" value={bulkForm.amount} onChange={(e) => setBulkForm({ ...bulkForm, amount: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-violet-500" placeholder="500000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Keterangan *</label>
              <input required type="text" value={bulkForm.description} onChange={(e) => setBulkForm({ ...bulkForm, description: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-violet-500" placeholder="mis. Biaya Bimbel Bulan Juni" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Jatuh Tempo *</label>
              <input required type="date" value={bulkForm.dueDate} onChange={(e) => setBulkForm({ ...bulkForm, dueDate: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-violet-500" />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={bulkSaving} className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
                {bulkSaving ? 'Membuat...' : '📦 Buat Invoice Massal'}
              </button>
              <button type="button" onClick={() => setShowBulkForm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">Batal</button>
            </div>
          </form>
          <p className="text-xs text-slate-400 mt-3">Invoice akan dibuat untuk semua siswa <strong>aktif</strong> yang terdaftar di kelas yang dipilih.</p>
        </div>
      )}

      {manualPayModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) { setManualPayModal(null); setManualNotes('') } }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setManualPayModal(null); setManualNotes('') } }}
          tabIndex={-1}
        >
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="font-bold text-slate-800 mb-1">Tandai Lunas Manual</h2>
            <p className="text-sm text-slate-500 mb-4">
              {manualPayModal.studentName} — {formatRupiah(manualPayModal.amount)}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Metode Pembayaran *</label>
                <select
                  value={manualMethod}
                  onChange={(e) => setManualMethod(e.target.value as typeof manualMethod)}
                  className="w-full px-3 py-2 rounded-xl border border-emerald-500 text-sm focus:outline-none focus:border-emerald-500 bg-white"
                >
                  <option value="CASH">Tunai (Bayar Langsung)</option>
                  <option value="BRI_TRANSFER">Transfer BRI (Manual)</option>
                  <option value="OTHER">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Catatan (opsional)</label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="mis. Bayar tunai ke Bu Mellyna tgl 1 Juni"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleManualPay}
                  disabled={manualSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 flex-1"
                >
                  {manualSaving ? 'Menyimpan...' : 'Konfirmasi Lunas'}
                </button>
                <button
                  onClick={() => { setManualPayModal(null); setManualNotes('') }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
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
