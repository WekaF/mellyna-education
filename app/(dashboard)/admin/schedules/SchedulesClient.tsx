'use client'

import { useState, useCallback, useMemo } from 'react'
import { Plus, Send, CalendarPlus, X, Info, Trash2 } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/common/DataTable'

interface Schedule {
  id: string
  date: string
  startTime: string
  endTime: string
  topic: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED'
  class: { name: string; tutor: { name: string } }
}

interface ClassOption {
  id: string
  name: string
  tutor: { name: string }
}

const statusConfig = {
  DRAFT: { label: 'Draft', color: 'bg-slate-100 text-slate-600' },
  PUBLISHED: { label: 'Diterbitkan', color: 'bg-emerald-100 text-emerald-700' },
  COMPLETED: { label: 'Selesai', color: 'bg-indigo-100 text-indigo-700' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-rose-100 text-rose-700' },
}

interface Props {
  initialSchedules: Schedule[]
  classes: ClassOption[]
}

export default function SchedulesClient({ initialSchedules, classes }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules)
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ classId: '', date: '', startTime: '', endTime: '', topic: '', location: '' })
  const [saving, setSaving] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceWeeks, setRecurrenceWeeks] = useState(12)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Timetable integration
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateForm, setGenerateForm] = useState(() => {
    const today = new Date()
    const currentDay = today.getDay()
    const daysUntilNextMonday = (1 - currentDay + 7) % 7 || 7
    const nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() + daysUntilNextMonday)
    return { startDate: nextMonday.toISOString().split('T')[0] }
  })
  const [generating, setGenerating] = useState(false)

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/schedules')
      setSchedules(await res.json())
    } catch {
      setError('Gagal memuat jadwal.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleGenerateWeekly = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/timetable/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generateForm),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Gagal sinkronisasi dari Timetable.')
      }
      alert(data.message || 'Jadwal berhasil disinkronkan dan disiarkan via WhatsApp!')
      setShowGenerateModal(false)
      await fetchSchedules()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const publishedSchedules = useMemo(
    () => schedules.filter(s => s.status === 'PUBLISHED'),
    [schedules]
  )

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    const publishedIds = publishedSchedules.map(s => s.id)
    const allSelected = publishedIds.every(id => selectedIds.has(id))
    setSelectedIds(allSelected ? new Set() : new Set(publishedIds))
  }, [publishedSchedules, selectedIds])

  const handleBulkDelete = useCallback(async () => {
    setDeleting(true)
    setError(null)
    try {
      await Promise.all(
        [...selectedIds].map(id =>
          fetch(`/api/schedules/${id}`, { method: 'DELETE' }).then(r => {
            if (!r.ok) throw new Error(`Gagal hapus jadwal ${id}`)
          })
        )
      )
      setSelectedIds(new Set())
      setShowDeleteConfirm(false)
      await fetchSchedules()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }, [selectedIds, fetchSchedules])

  const handlePublish = useCallback(async (id: string) => {
    setPublishing(id)
    try {
      const res = await fetch(`/api/schedules/${id}/publish`, { method: 'POST' })
      if (!res.ok) throw new Error()
      await fetchSchedules()
    } catch {
      setError('Gagal menerbitkan jadwal.')
    } finally {
      setPublishing(null)
    }
  }, [fetchSchedules])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, isRecurring, recurrenceWeeks: isRecurring ? recurrenceWeeks : 1 }),
      })
      if (!res.ok) throw new Error('Gagal membuat jadwal.')
      const data = await res.json()
      await fetchSchedules()
      setShowForm(false)
      setIsRecurring(false)
      setRecurrenceWeeks(12)
      setForm({ classId: '', date: '', startTime: '', endTime: '', topic: '', location: '' })
      if (data.count > 1) alert(`${data.count} jadwal berhasil dibuat (jadwal berulang mingguan).`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const allPublishedSelected =
    publishedSchedules.length > 0 &&
    publishedSchedules.every(s => selectedIds.has(s.id))

  const columns = useMemo<ColumnDef<Schedule>[]>(() => [
    {
      id: 'select',
      header: () => (
        <input
          type="checkbox"
          checked={allPublishedSelected}
          onChange={toggleSelectAll}
          title="Pilih semua jadwal Diterbitkan"
          className="w-4 h-4 cursor-pointer accent-rose-600"
        />
      ),
      enableSorting: false,
      cell: ({ row }) => {
        const s = row.original
        if (s.status !== 'PUBLISHED') return null
        return (
          <input
            type="checkbox"
            checked={selectedIds.has(s.id)}
            onChange={() => toggleSelect(s.id)}
            className="w-4 h-4 cursor-pointer accent-rose-600"
          />
        )
      },
    },
    {
      id: 'class',
      accessorFn: (row) => row.class.name,
      header: 'Kelas',
      cell: ({ getValue }) => (
        <span className="font-semibold text-slate-800">{getValue() as string}</span>
      ),
    },
    {
      id: 'date',
      accessorFn: (row) =>
        new Date(row.date).toLocaleDateString('id-ID', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      header: 'Tanggal',
      cell: ({ getValue }) => <span className="text-slate-600">{getValue() as string}</span>,
    },
    {
      id: 'jam',
      header: 'Jam',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-slate-600">
          {row.original.startTime} – {row.original.endTime}
        </span>
      ),
    },
    {
      accessorKey: 'topic',
      header: 'Topik',
      cell: ({ getValue }) => (
        <span className="text-slate-500">{(getValue() as string | null) || '-'}</span>
      ),
    },
    {
      id: 'tutor',
      accessorFn: (row) => row.class.tutor.name,
      header: 'Tutor',
      cell: ({ getValue }) => <span className="text-slate-500">{getValue() as string}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const cfg = statusConfig[getValue() as Schedule['status']]
        return (
          <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>
            {cfg.label}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const s = row.original
        if (s.status !== 'DRAFT') return null
        return (
          <button
            onClick={() => handlePublish(s.id)}
            disabled={publishing === s.id}
            className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Send className="h-3 w-3" />
            {publishing === s.id ? 'Mengirim...' : 'Terbitkan + WA'}
          </button>
        )
      },
    },
  ], [publishing, handlePublish, selectedIds, toggleSelect, allPublishedSelected, toggleSelectAll])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">📅 Jadwal Bimbel</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola dan terbitkan jadwal sesi belajar.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Trash2 className="h-4 w-4" /> Hapus {selectedIds.size} Jadwal
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Plus className="h-4 w-4" /> Buat Jadwal
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <CalendarPlus className="h-4 w-4" /> Ambil dari Timetable
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">
          ⚠️ {error}
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6">
          <h2 className="font-bold text-slate-800 mb-4">Buat Jadwal Baru</h2>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kelas *</label>
              <select
                required
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
              >
                <option value="">Pilih Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Tutor: {c.tutor.name})
                  </option>
                ))}
              </select>
            </div>
            {[
              { label: 'Tanggal *', key: 'date', type: 'date', placeholder: '' },
              { label: 'Jam Mulai *', key: 'startTime', type: 'time', placeholder: '' },
              { label: 'Jam Selesai *', key: 'endTime', type: 'time', placeholder: '' },
              { label: 'Topik/Materi', key: 'topic', type: 'text', placeholder: 'mis. Persamaan Linear' },
              { label: 'Lokasi', key: 'location', type: 'text', placeholder: 'mis. Ruang A' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                <input
                  required={label.includes('*')}
                  type={type}
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder={placeholder}
                />
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isRecurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                />
                <label htmlFor="isRecurring" className="text-sm font-semibold text-slate-700 cursor-pointer">
                  Jadwal Berulang Mingguan
                </label>
              </div>
              {isRecurring && (
                <div className="mt-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Jumlah Minggu *</label>
                  <input
                    type="number"
                    min={2}
                    max={52}
                    value={recurrenceWeeks}
                    onChange={(e) => setRecurrenceWeeks(Number(e.target.value))}
                    className="w-40 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Akan membuat {recurrenceWeeks} jadwal mingguan sekaligus
                  </p>
                </div>
              )}
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
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
          data={schedules}
          loading={loading}
          searchPlaceholder="Cari kelas, topik, tutor..."
          emptyMessage="Belum ada jadwal yang dibuat."
          emptyIcon="📭"
        />
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-3xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-rose-50/40 dark:bg-slate-800/40">
              <h3 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                <Trash2 className="h-4 w-4 text-rose-600" />
                Konfirmasi Hapus Jadwal
              </h3>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Anda akan menghapus <strong>{selectedIds.size} jadwal</strong> berstatus{' '}
                <span className="font-bold text-emerald-700">Diterbitkan</span> secara permanen.
                Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting ? 'Menghapus...' : `Ya, Hapus ${selectedIds.size} Jadwal`}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold px-5 py-2.5 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timetable Sync Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-emerald-50/40 dark:bg-slate-800/40">
              <h3 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                <CalendarPlus className="h-4.5 w-4.5 text-emerald-600" />
                Ambil Jadwal dari Timetable
              </h3>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleGenerateWeekly} className="p-6 space-y-4">
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 p-4 text-amber-800 dark:text-amber-300 text-xs space-y-2">
                <div className="flex gap-2 font-bold items-center">
                  <Info className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                  SINKRONISASI JADWAL &amp; WAHA
                </div>
                <p className="leading-relaxed">
                  Tindakan ini akan mengambil semua Sesi Kelas tetap yang dikonfigurasi di Timetable, menghitung tanggal riilnya untuk minggu yang dipilih, dan menerbitkannya.
                </p>
                <p className="font-semibold leading-relaxed">
                  Jadwal baru akan otomatis dibuat dalam status <strong className="underline">Diterbitkan (PUBLISHED)</strong>, dan notifikasi WhatsApp akan dikirim otomatis ke WhatsApp Orang Tua Siswa &amp; Tutor!
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Tanggal Mulai Minggu (Senin) *</label>
                <input
                  required
                  type="date"
                  value={generateForm.startDate}
                  onChange={(e) => setGenerateForm({ ...generateForm, startDate: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 justify-end">
                <button
                  type="submit"
                  disabled={generating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  {generating ? 'Sinkronisasi & Kirim WA...' : 'Sinkronkan Sekarang'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
