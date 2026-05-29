'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatRupiah } from '@/lib/utils'

interface Invoice {
  id: string
  description: string
  amount: number
  dueDate: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  paidAt: string | null
  student: { name: string }
  payments: { method: string | null; paidAt: string | null }[]
}

const statusConfig = {
  PENDING: { label: 'Belum Lunas', color: 'bg-amber-100 text-amber-700' },
  PAID: { label: 'Lunas', color: 'bg-emerald-100 text-emerald-700' },
  OVERDUE: { label: 'Terlambat', color: 'bg-rose-100 text-rose-700' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-slate-100 text-slate-600' },
}

declare global {
  interface Window {
    snap: { pay: (token: string, options: any) => void }
  }
}

export default function ParentBillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState<string | null>(null)
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

  const handlePay = async (invoiceId: string) => {
    setPaying(invoiceId)
    setError(null)
    try {
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      })
      if (!res.ok) throw new Error('Gagal membuat sesi pembayaran.')
      const { token } = await res.json()

      window.snap.pay(token, {
        onSuccess: () => { fetchInvoices(); setPaying(null) },
        onPending: () => { fetchInvoices(); setPaying(null) },
        onError: () => { setError('Pembayaran gagal. Silakan coba lagi.'); setPaying(null) },
        onClose: () => { setPaying(null) },
      })
    } catch (err: any) {
      setError(err.message)
      setPaying(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-800">💳 Tagihan & Pembayaran</h1>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">⚠️ {error}</div>}

      {loading ? (
        <div className="p-10 text-center"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" /></div>
      ) : invoices.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
          <p className="text-3xl">🎉</p>
          <p className="mt-2 font-medium text-sm">Tidak ada tagihan aktif saat ini. Semua sudah lunas!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const cfg = statusConfig[inv.status]
            const isOverdue = inv.status === 'PENDING' && new Date(inv.dueDate) < new Date()
            return (
              <div key={inv.id} className={`rounded-2xl bg-white border shadow-xs p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${isOverdue ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100'}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-800">{inv.student.name}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <p className="text-sm text-slate-600">{inv.description}</p>
                  <p className={`text-xs mt-1 ${isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
                    Jatuh tempo: {new Date(inv.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {isOverdue && ' ⚠️ Terlambat!'}
                  </p>
                  {inv.status === 'PAID' && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-emerald-600 font-medium">
                      <span>✅ Lunas</span>
                      {inv.paidAt && (
                        <span className="text-slate-400">
                          — {new Date(inv.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      )}
                      {inv.payments?.[0]?.method && (
                        <span className="text-slate-400">
                          via {
                            inv.payments[0].method === 'CASH' ? 'Tunai' :
                            inv.payments[0].method === 'BRI_TRANSFER' ? 'Transfer BRI' :
                            inv.payments[0].method === 'gopay' ? 'GoPay' :
                            inv.payments[0].method === 'shopeepay' ? 'ShopeePay' :
                            inv.payments[0].method === 'bri_va' ? 'BRI Virtual Account' :
                            inv.payments[0].method === 'qris' ? 'QRIS' :
                            inv.payments[0].method === 'alfamart' ? 'Alfamart' :
                            inv.payments[0].method === 'indomaret' ? 'Indomaret' :
                            inv.payments[0].method
                          }
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-extrabold text-slate-800">{formatRupiah(inv.amount)}</span>
                  {inv.status === 'PENDING' && (
                    <button
                      onClick={() => handlePay(inv.id)}
                      disabled={paying === inv.id}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      {paying === inv.id ? 'Memproses...' : 'Bayar Sekarang'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
