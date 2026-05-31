'use client'

import { useState, useRef, useEffect } from 'react'
import { ReportPeriodType } from '@prisma/client'
import { Plus, FileText, Trash2, Download, Send, Search, X } from 'lucide-react'

type Student = { id: string; name: string; grade: string | null }
type Report = {
  id: string
  periodLabel: string
  periodType: ReportPeriodType
  notes: string | null
  notifiedAt: string | null
  createdAt: string
  student: { name: string }
  generatedBy: { name: string }
}

const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
]
const PERIOD_LABELS: Record<ReportPeriodType, string> = {
  MONTHLY: 'Bulanan',
  SEMESTER: 'Per Semester',
  CUSTOM: 'Bebas',
}

function buildPeriodDates(
  type: ReportPeriodType,
  monthIdx: number,
  year: number,
  semester: number,
  customStart: string,
  customEnd: string
): { start: Date; end: Date; label: string } | null {
  if (type === 'MONTHLY') {
    const start = new Date(year, monthIdx, 1)
    const end = new Date(year, monthIdx + 1, 0, 23, 59, 59)
    return { start, end, label: `${MONTHS[monthIdx]} ${year}` }
  }
  if (type === 'SEMESTER') {
    if (semester === 1) {
      return {
        start: new Date(year, 0, 1),
        end: new Date(year, 5, 30, 23, 59, 59),
        label: `Semester 1 ${year}`,
      }
    }
    return {
      start: new Date(year, 6, 1),
      end: new Date(year, 11, 31, 23, 59, 59),
      label: `Semester 2 ${year}`,
    }
  }
  if (type === 'CUSTOM') {
    if (!customStart || !customEnd) return null
    const start = new Date(customStart)
    const end = new Date(customEnd + 'T23:59:59')
    const fmt = (d: Date) =>
      d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    return { start, end, label: `${fmt(start)} – ${fmt(end)}` }
  }
  return null
}

export default function MilestoneReportsClient({
  students,
  initialReports,
}: {
  students: Student[]
  initialReports: Report[]
}) {
  const [reports, setReports] = useState<Report[]>(initialReports)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    studentId: '',
    periodType: 'MONTHLY' as ReportPeriodType,
    monthIdx: new Date().getMonth(),
    year: new Date().getFullYear(),
    semester: 1,
    customStart: '',
    customEnd: '',
    notes: '',
    sendWhatsApp: false,
  })

  const selectedStudent = students.find((s) => s.id === form.studentId)
  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSubmit = async () => {
    if (!form.studentId) { setError('Pilih siswa terlebih dahulu'); return }
    const period = buildPeriodDates(
      form.periodType, form.monthIdx, form.year,
      form.semester, form.customStart, form.customEnd
    )
    if (!period) { setError('Lengkapi rentang periode'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/milestone-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: form.studentId,
          periodType: form.periodType,
          periodLabel: period.label,
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
          notes: form.notes || undefined,
          sendWhatsApp: form.sendWhatsApp,
        }),
      })
      if (!res.ok) throw new Error('Gagal menerbitkan raport')
      const created = await res.json()
      setReports((prev) => [created, ...prev])
      setShowForm(false)
      setForm({
        studentId: '', periodType: 'MONTHLY',
        monthIdx: new Date().getMonth(), year: new Date().getFullYear(),
        semester: 1, customStart: '', customEnd: '', notes: '', sendWhatsApp: false,
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus raport ini?')) return
    try {
      const res = await fetch(`/api/milestone-reports/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setReports((prev) => prev.filter((r) => r.id !== id))
    } catch {
      alert('Gagal menghapus raport')
    }
  }

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-700 p-5 sm:p-8 text-white shadow-xl shadow-violet-600/10">
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">Raport Milestone</h1>
        <p className="mt-2 text-sm sm:text-base text-violet-100">
          Terbitkan raport perkembangan belajar siswa per periode.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
        >
          <Plus className="h-4 w-4" />
          Terbitkan Raport
        </button>
      </div>

      {/* Reports List */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden">
        {reports.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <p className="text-3xl">📋</p>
            <p className="mt-2 text-sm">Belum ada raport diterbitkan.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-6 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/30">
                  <FileText className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800 dark:text-white">{r.student.name}</p>
                  <p className="text-xs text-slate-500">
                    {r.periodLabel} · {PERIOD_LABELS[r.periodType]} · Diterbitkan {fmtDate(r.createdAt)}
                  </p>
                  <p className="text-xs text-slate-400">
                    oleh {r.generatedBy.name}{r.notifiedAt ? ' · WA terkirim ✓' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`/api/milestone-reports/${r.id}/pdf`}
                    download
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    PDF
                  </a>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 border border-rose-100 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <h3 className="font-extrabold text-slate-800 dark:text-white">Terbitkan Raport Milestone</h3>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-600">
                {error}
              </div>
            )}

            {/* Student search */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Siswa</label>
              <div className="relative mt-1.5" ref={searchRef}>
                {selectedStudent && !showDropdown ? (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-2.5">
                    <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-white">
                      {selectedStudent.name}
                    </span>
                    <button
                      onClick={() => { setForm({ ...form, studentId: '' }); setSearchQuery('') }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true) }}
                        onFocus={() => setShowDropdown(true)}
                        placeholder="Cari nama siswa..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    {showDropdown && (
                      <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
                        <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                          {filteredStudents.length === 0 ? (
                            <li className="px-4 py-3 text-sm text-slate-400">Tidak ditemukan</li>
                          ) : (
                            filteredStudents.map((s) => (
                              <li key={s.id}>
                                <button
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    setForm({ ...form, studentId: s.id })
                                    setSearchQuery('')
                                    setShowDropdown(false)
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-800 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
                                >
                                  {s.name}
                                  {s.grade && (
                                    <span className="ml-1.5 text-xs font-normal text-slate-400">
                                      ({s.grade})
                                    </span>
                                  )}
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Period type */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Tipe Periode
              </label>
              <div className="flex gap-2 mt-1.5">
                {(['MONTHLY', 'SEMESTER', 'CUSTOM'] as ReportPeriodType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, periodType: t })}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      form.periodType === t
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {PERIOD_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Period config — MONTHLY */}
            {form.periodType === 'MONTHLY' && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bulan</label>
                  <select
                    value={form.monthIdx}
                    onChange={(e) => setForm({ ...form, monthIdx: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
                <div className="w-28">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tahun</label>
                  <input
                    type="number" value={form.year} min={2020} max={2099}
                    onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Period config — SEMESTER */}
            {form.periodType === 'SEMESTER' && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Semester</label>
                  <div className="flex gap-2 mt-1.5">
                    {[1, 2].map((s) => (
                      <button
                        key={s}
                        onClick={() => setForm({ ...form, semester: s })}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                          form.semester === s
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Semester {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-28">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tahun</label>
                  <input
                    type="number" value={form.year} min={2020} max={2099}
                    onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Period config — CUSTOM */}
            {form.periodType === 'CUSTOM' && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mulai</label>
                  <input
                    type="date" value={form.customStart}
                    onChange={(e) => setForm({ ...form, customStart: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sampai</label>
                  <input
                    type="date" value={form.customEnd}
                    onChange={(e) => setForm({ ...form, customEnd: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Catatan (opsional)
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Catatan umum untuk raport ini..."
                className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* WhatsApp toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`relative w-10 h-5 rounded-full transition-colors ${form.sendWhatsApp ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
              >
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.sendWhatsApp ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </div>
              <input
                type="checkbox"
                checked={form.sendWhatsApp}
                onChange={(e) => setForm({ ...form, sendWhatsApp: e.target.checked })}
                className="sr-only"
              />
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-emerald-500" />
                  Kirim WhatsApp ke orang tua
                </p>
                <p className="text-xs text-slate-400">PDF raport dikirim langsung ke nomor WA orang tua</p>
              </div>
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
              >
                {loading ? 'Menerbitkan...' : 'Terbitkan Raport'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
