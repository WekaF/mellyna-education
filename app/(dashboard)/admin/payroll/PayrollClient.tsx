'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Tutor = {
  id: string
  name: string
  rate: {
    dailyRate: number
    onTimeBonusRate: number
    overtimeRatePerHour: number
    extraHandleRate: number
  } | null
}

type Entry = {
  id: string
  tutor: { id: string; name: string }
  periodMonth: string
  hariKerja: number
  izinHari: number
  bonusOntimeDays: number
  extraTimeHours: number
  extraHandleCount: number
  dailyRateAmount: number
  bonusOntimeAmount: number
  extraTimeAmount: number
  extraHandleAmount: number
  totalAmount: number
  status: 'DRAFT' | 'FINALIZED'
}

type LeaveRequest = { id: string; tutor: { id: string; name: string }; date: string; reason: string }
type OvertimeEntry = { id: string; tutor: { id: string; name: string }; date: string; hours: number; note: string | null }

interface Props {
  defaultPeriod: string
  tutors: Tutor[]
  initialEntries: Entry[]
  pendingLeaves: LeaveRequest[]
  overtimeEntries: OvertimeEntry[]
}

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`

export default function PayrollClient({ defaultPeriod, tutors, initialEntries, pendingLeaves, overtimeEntries }: Props) {
  const router = useRouter()
  const [periodMonth, setPeriodMonth] = useState(defaultPeriod)
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [rateForm, setRateForm] = useState<Record<string, { dailyRate: string; onTimeBonusRate: string; overtimeRatePerHour: string; extraHandleRate: string }>>(
    Object.fromEntries(
      tutors.map((t) => [
        t.id,
        {
          dailyRate: String(t.rate?.dailyRate ?? ''),
          onTimeBonusRate: String(t.rate?.onTimeBonusRate ?? ''),
          overtimeRatePerHour: String(t.rate?.overtimeRatePerHour ?? ''),
          extraHandleRate: String(t.rate?.extraHandleRate ?? ''),
        },
      ]),
    ),
  )
  const [savingRateFor, setSavingRateFor] = useState<string | null>(null)

  const [leaveForm, setLeaveForm] = useState({ tutorId: tutors[0]?.id ?? '', date: '', reason: '' })
  const [overtimeForm, setOvertimeForm] = useState({ tutorId: tutors[0]?.id ?? '', date: '', hours: '', note: '' })

  const fetchEntries = async (month: string) => {
    const res = await fetch(`/api/admin/payroll?periodMonth=${month}`)
    const data = await res.json()
    if (res.ok) setEntries(data.entries)
  }

  const handlePeriodChange = async (month: string) => {
    setPeriodMonth(month)
    await fetchEntries(month)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/payroll/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodMonth }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal generate payroll.')
        return
      }
      await fetchEntries(periodMonth)
    } finally {
      setGenerating(false)
    }
  }

  const handleFinalize = async (id: string) => {
    const res = await fetch(`/api/admin/payroll/${id}/finalize`, { method: 'PATCH' })
    if (res.ok) await fetchEntries(periodMonth)
  }

  const handleSaveRate = async (tutorId: string) => {
    setSavingRateFor(tutorId)
    try {
      const f = rateForm[tutorId]
      await fetch('/api/admin/payroll/rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorId,
          dailyRate: Number(f.dailyRate),
          onTimeBonusRate: Number(f.onTimeBonusRate),
          overtimeRatePerHour: Number(f.overtimeRatePerHour),
          extraHandleRate: Number(f.extraHandleRate),
        }),
      })
      router.refresh()
    } finally {
      setSavingRateFor(null)
    }
  }

  const handleMarkLeave = async () => {
    if (!leaveForm.tutorId || !leaveForm.date) return
    await fetch('/api/admin/payroll/leave-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leaveForm),
    })
    setLeaveForm({ tutorId: tutors[0]?.id ?? '', date: '', reason: '' })
    router.refresh()
  }

  const handleDecideLeave = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await fetch(`/api/admin/payroll/leave-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    router.refresh()
  }

  const handleLogOvertime = async () => {
    if (!overtimeForm.tutorId || !overtimeForm.date || !overtimeForm.hours) return
    await fetch('/api/admin/payroll/overtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...overtimeForm, hours: Number(overtimeForm.hours) }),
    })
    setOvertimeForm({ tutorId: tutors[0]?.id ?? '', date: '', hours: '', note: '' })
    router.refresh()
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-indigo-600 to-indigo-800 p-8 text-white shadow-xl">
        <h1 className="text-3xl font-extrabold tracking-tight">Payroll Karyawan 💰</h1>
        <p className="mt-2 text-indigo-100">Hari kerja, izin, bonus ontime, extra time, dan extra handle — per tutor, per bulan.</p>
      </div>

      {/* Generate payroll */}
      <section className="rounded-2xl bg-white border border-slate-100 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-3">Generate Payroll</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="month"
            value={periodMonth}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer"
          >
            {generating ? 'Memproses...' : 'Generate / Refresh'}
          </button>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-2 pr-3">Tutor</th>
                <th className="py-2 pr-3">Hari Kerja</th>
                <th className="py-2 pr-3">Izin</th>
                <th className="py-2 pr-3">Ontime</th>
                <th className="py-2 pr-3">Extra Time</th>
                <th className="py-2 pr-3">Extra Handle</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">
                    Belum ada payroll untuk periode ini.
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50">
                    <td className="py-2 pr-3 font-semibold text-slate-700">{e.tutor.name}</td>
                    <td className="py-2 pr-3">{e.hariKerja} ({rupiah(e.dailyRateAmount)})</td>
                    <td className="py-2 pr-3">{e.izinHari}</td>
                    <td className="py-2 pr-3">{e.bonusOntimeDays} ({rupiah(e.bonusOntimeAmount)})</td>
                    <td className="py-2 pr-3">{e.extraTimeHours}j ({rupiah(e.extraTimeAmount)})</td>
                    <td className="py-2 pr-3">{e.extraHandleCount} ({rupiah(e.extraHandleAmount)})</td>
                    <td className="py-2 pr-3 font-bold text-slate-800">{rupiah(e.totalAmount)}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${e.status === 'FINALIZED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {e.status === 'DRAFT' && (
                        <button onClick={() => handleFinalize(e.id)} className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer">
                          Finalize
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Rate per tutor */}
      <section className="rounded-2xl bg-white border border-slate-100 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-3">Rate per Tutor</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-2 pr-3">Tutor</th>
                <th className="py-2 pr-3">Rp/Hari Kerja</th>
                <th className="py-2 pr-3">Rp Bonus Ontime</th>
                <th className="py-2 pr-3">Rp/Jam Extra Time</th>
                <th className="py-2 pr-3">Rp/Sesi Extra Handle</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {tutors.map((t) => {
                const f = rateForm[t.id]
                const setField = (key: keyof typeof f, value: string) =>
                  setRateForm((prev) => ({ ...prev, [t.id]: { ...prev[t.id], [key]: value } }))
                return (
                  <tr key={t.id} className="border-b border-slate-50">
                    <td className="py-2 pr-3 font-semibold text-slate-700">{t.name}</td>
                    {(['dailyRate', 'onTimeBonusRate', 'overtimeRatePerHour', 'extraHandleRate'] as const).map((key) => (
                      <td key={key} className="py-2 pr-3">
                        <input
                          type="number"
                          value={f[key]}
                          onChange={(e) => setField(key, e.target.value)}
                          className="w-28 border border-slate-200 rounded-lg px-2 py-1 text-sm"
                        />
                      </td>
                    ))}
                    <td className="py-2 pr-3">
                      <button
                        onClick={() => handleSaveRate(t.id)}
                        disabled={savingRateFor === t.id}
                        className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        Simpan
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Izin */}
      <section className="rounded-2xl bg-white border border-slate-100 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-3">Izin</h2>

        <div className="flex flex-wrap items-end gap-3 mb-5">
          <select
            value={leaveForm.tutorId}
            onChange={(e) => setLeaveForm({ ...leaveForm, tutorId: e.target.value })}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
          >
            {tutors.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={leaveForm.date}
            onChange={(e) => setLeaveForm({ ...leaveForm, date: e.target.value })}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Alasan (opsional)"
            value={leaveForm.reason}
            onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm flex-1 min-w-40"
          />
          <button onClick={handleMarkLeave} className="bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">
            Tandai Izin (langsung approved)
          </button>
        </div>

        <p className="text-xs font-semibold text-slate-400 mb-2">Pengajuan dari tutor — menunggu keputusan</p>
        {pendingLeaves.length === 0 ? (
          <p className="text-sm text-slate-400">Tidak ada pengajuan izin pending.</p>
        ) : (
          <div className="space-y-2">
            {pendingLeaves.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm">
                <div>
                  <span className="font-semibold text-slate-700">{l.tutor.name}</span>{' '}
                  <span className="text-slate-400">{new Date(l.date).toLocaleDateString('id-ID')}</span>
                  <p className="text-slate-500">{l.reason}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleDecideLeave(l.id, 'APPROVED')} className="text-xs font-semibold text-emerald-600 hover:underline cursor-pointer">
                    Setujui
                  </button>
                  <button onClick={() => handleDecideLeave(l.id, 'REJECTED')} className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer">
                    Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Extra time */}
      <section className="rounded-2xl bg-white border border-slate-100 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Extra Time (Lembur)</h2>
        <p className="text-xs text-slate-400 mb-3">Tidak ada jam pulang otomatis di sistem — dicatat manual per tanggal.</p>

        <div className="flex flex-wrap items-end gap-3 mb-5">
          <select
            value={overtimeForm.tutorId}
            onChange={(e) => setOvertimeForm({ ...overtimeForm, tutorId: e.target.value })}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
          >
            {tutors.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={overtimeForm.date}
            onChange={(e) => setOvertimeForm({ ...overtimeForm, date: e.target.value })}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
          <input
            type="number"
            step="0.5"
            placeholder="Jam"
            value={overtimeForm.hours}
            onChange={(e) => setOvertimeForm({ ...overtimeForm, hours: e.target.value })}
            className="w-24 border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Catatan (opsional)"
            value={overtimeForm.note}
            onChange={(e) => setOvertimeForm({ ...overtimeForm, note: e.target.value })}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm flex-1 min-w-40"
          />
          <button onClick={handleLogOvertime} className="bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">
            Catat Lembur
          </button>
        </div>

        <div className="space-y-2">
          {overtimeEntries.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm">
              <div>
                <span className="font-semibold text-slate-700">{o.tutor.name}</span>{' '}
                <span className="text-slate-400">{new Date(o.date).toLocaleDateString('id-ID')}</span>
                {o.note && <p className="text-slate-500">{o.note}</p>}
              </div>
              <span className="font-bold text-slate-700">{o.hours} jam</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
