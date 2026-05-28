'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
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

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">💳 Tagihan & Invoice</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola tagihan bimbel dan pantau status pembayaran.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Buat Invoice
        </button>
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">⚠️ {error}</div>}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6">
          <h2 className="font-bold text-slate-800 mb-4">Buat Invoice Baru</h2>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            {[
              { label: 'ID Siswa *', key: 'studentId', type: 'text', placeholder: 'Student ID' },
              { label: 'Nominal (Rp) *', key: 'amount', type: 'number', placeholder: '500000' },
              { label: 'Keterangan *', key: 'description', type: 'text', placeholder: 'mis. Biaya Bimbel Bulan Juni' },
              { label: 'Jatuh Tempo *', key: 'dueDate', type: 'date', placeholder: '' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                <input
                  required
                  type={type}
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder={placeholder}
                />
              </div>
            ))}
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Buat Invoice'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">Batal</button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-10 text-center"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" /></div>
        ) : invoices.length === 0 ? (
          <div className="p-10 text-center text-slate-400"><p className="text-3xl">💰</p><p className="mt-2 text-sm">Belum ada tagihan.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {['Siswa', 'Keterangan', 'Nominal', 'Jatuh Tempo', 'Status'].map((h) => (
                    <th key={h} className="text-left px-6 py-3.5 font-semibold text-slate-500 text-xs uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const cfg = statusConfig[inv.status]
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-semibold text-slate-800">{inv.student.name}</td>
                      <td className="px-6 py-4 text-slate-600">{inv.description}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{formatRupiah(inv.amount)}</td>
                      <td className="px-6 py-4 text-slate-500">{new Date(inv.dueDate).toLocaleDateString('id-ID')}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
