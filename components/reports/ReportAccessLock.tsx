'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lock, Send, Clock, XCircle, MapPin } from 'lucide-react'
import type { TutorReportAccess } from '@/lib/report-access'

interface Props {
  scheduleId: string
  access: TutorReportAccess
  onChange: (access: TutorReportAccess) => void
}

export function ReportAccessLock({ scheduleId, access, onChange }: Props) {
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = access.request
  const canStillCheckIn = access.checkInWindow === 'open' || access.checkInWindow === 'not-open'

  const submit = async () => {
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/report-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId, reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Gagal mengirim permintaan.')
      onChange({ ...access, request: data })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  if (access.reason === 'schedule-not-found') {
    return (
      <div className="rounded-2xl bg-white border border-amber-200 shadow-xs p-6 flex items-start gap-3">
        <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-slate-600">Jadwal tidak ditemukan, atau bukan jadwal kelas yang kamu ajar.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white border border-amber-200 shadow-xs p-6 space-y-4">
      <div className="flex items-start gap-3">
        <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-bold text-slate-800">Laporan terkunci</h2>
          <p className="text-sm text-slate-600 mt-1">
            Kamu belum absen untuk jadwal ini. Laporan hanya bisa ditulis setelah absen di lokasi bimbel.
          </p>
        </div>
      </div>

      {canStillCheckIn && (
        <Link
          href="/tutor"
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
        >
          <MapPin className="h-4 w-4" />
          Absen di Dashboard
        </Link>
      )}

      <div className="border-t border-slate-100 pt-4 space-y-3">
        <p className="text-sm font-semibold text-slate-700">Tidak bisa absen?</p>

        {request?.status === 'PENDING' ? (
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-200 p-3">
            <Clock className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-slate-700">Permintaan akses menunggu persetujuan Super Admin.</p>
              <p className="text-xs text-slate-500 mt-1">Alasan: {request.reason}</p>
              <p className="text-xs text-slate-400 mt-1">Muat ulang halaman ini setelah disetujui.</p>
            </div>
          </div>
        ) : (
          <>
            {request?.status === 'REJECTED' && (
              <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-100 p-3">
                <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-sm text-rose-700">
                  Permintaan sebelumnya ditolak{request.adminNote ? `: ${request.adminNote}` : '.'}
                </p>
              </div>
            )}
            <p className="text-xs text-slate-500">
              Jelaskan alasannya ke Super Admin (mis. GPS HP rusak, lupa absen). Jika disetujui, laporan jadwal
              ini akan terbuka.
            </p>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 resize-none"
              placeholder="Alasan tidak absen..."
            />
            {error && <p className="text-sm text-rose-600">⚠️ {error}</p>}
            <button
              onClick={submit}
              disabled={sending || reason.trim().length < 5}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Mengirim...' : 'Minta Akses ke Super Admin'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
