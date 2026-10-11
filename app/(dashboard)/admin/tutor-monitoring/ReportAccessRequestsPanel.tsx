'use client'

import { useState } from 'react'
import { KeyRound, Check, X } from 'lucide-react'

export type AccessRequestRow = {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reason: string
  adminNote: string | null
  createdAt: string
  tutorName: string
  className: string
  scheduleDate: string
  startTime: string
  endTime: string
}

const statusStyle = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-600',
}

const statusLabel = { PENDING: 'MENUNGGU', APPROVED: 'DISETUJUI', REJECTED: 'DITOLAK' }

export function ReportAccessRequestsPanel({ initialRequests }: { initialRequests: AccessRequestRow[] }) {
  const [requests, setRequests] = useState(initialRequests)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length

  const decide = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/report-access/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNote: notes[id] ?? '' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Gagal menyimpan keputusan.')
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: data.status, adminNote: data.adminNote } : r)),
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
      <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-100">
        <KeyRound className="h-5 w-5 text-indigo-600" />
        <div>
          <p className="font-bold text-slate-800">Permintaan Akses Laporan</p>
          <p className="text-xs text-slate-500">
            Tutor yang tidak absen dan meminta dibukakan akses menulis laporan.
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
            {pendingCount} menunggu
          </span>
        )}
      </div>

      {error && <p className="px-6 py-3 text-sm text-rose-600">⚠️ {error}</p>}

      {requests.length === 0 ? (
        <p className="px-6 py-6 text-center text-sm text-slate-400">Belum ada permintaan.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {requests.map((r) => (
            <div key={r.id} className="px-6 py-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">
                    {r.tutorName} <span className="font-normal text-slate-500">• {r.className}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(r.scheduleDate).toLocaleDateString('id-ID', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    • {r.startTime}–{r.endTime}
                  </p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyle[r.status]}`}>
                  {statusLabel[r.status]}
                </span>
              </div>

              <p className="text-sm text-slate-600">Alasan: {r.reason}</p>
              {r.status !== 'PENDING' && r.adminNote && (
                <p className="text-xs text-slate-500">Catatan admin: {r.adminNote}</p>
              )}

              {r.status === 'PENDING' && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    maxLength={500}
                    placeholder="Catatan (opsional)"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => decide(r.id, 'APPROVED')}
                    disabled={busyId === r.id}
                    className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Setujui
                  </button>
                  <button
                    onClick={() => decide(r.id, 'REJECTED')}
                    disabled={busyId === r.id}
                    className="flex items-center justify-center gap-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Tolak
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
