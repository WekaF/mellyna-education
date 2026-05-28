'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Send } from 'lucide-react'

interface Schedule {
  id: string
  date: string
  startTime: string
  endTime: string
  topic: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED'
  class: { name: string; tutor: { name: string } }
}

const statusConfig = {
  DRAFT: { label: 'Draft', color: 'bg-slate-100 text-slate-600' },
  PUBLISHED: { label: 'Diterbitkan', color: 'bg-emerald-100 text-emerald-700' },
  COMPLETED: { label: 'Selesai', color: 'bg-indigo-100 text-indigo-700' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-rose-100 text-rose-700' },
}

export default function AdminSchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ classId: '', date: '', startTime: '', endTime: '', topic: '', location: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  const handlePublish = async (id: string) => {
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
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Gagal membuat jadwal.')
      await fetchSchedules()
      setShowForm(false)
      setForm({ classId: '', date: '', startTime: '', endTime: '', topic: '', location: '' })
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
          <h1 className="text-2xl font-extrabold text-slate-800">📅 Jadwal Bimbel</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola dan terbitkan jadwal sesi belajar.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Buat Jadwal
        </button>
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">⚠️ {error}</div>}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6">
          <h2 className="font-bold text-slate-800 mb-4">Buat Jadwal Baru</h2>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'ID Kelas *', key: 'classId', type: 'text', placeholder: 'Class ID' },
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
            <div className="sm:col-span-2 lg:col-span-3 flex gap-3">
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">Batal</button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-10 text-center"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" /></div>
        ) : schedules.length === 0 ? (
          <div className="p-10 text-center text-slate-400"><p className="text-3xl">📭</p><p className="mt-2 text-sm">Belum ada jadwal yang dibuat.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {['Kelas', 'Tanggal', 'Jam', 'Topik', 'Tutor', 'Status', ''].map((h) => (
                    <th key={h} className="text-left px-6 py-3.5 font-semibold text-slate-500 text-xs uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map((s) => {
                  const cfg = statusConfig[s.status]
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-semibold text-slate-800">{s.class.name}</td>
                      <td className="px-6 py-4 text-slate-600">{new Date(s.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="px-6 py-4 text-slate-600">{s.startTime} – {s.endTime}</td>
                      <td className="px-6 py-4 text-slate-500">{s.topic || '-'}</td>
                      <td className="px-6 py-4 text-slate-500">{s.class.tutor.name}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="px-6 py-4">
                        {s.status === 'DRAFT' && (
                          <button
                            onClick={() => handlePublish(s.id)}
                            disabled={publishing === s.id}
                            className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50 transition-colors"
                          >
                            <Send className="h-3 w-3" />
                            {publishing === s.id ? 'Mengirim...' : 'Terbitkan + WA'}
                          </button>
                        )}
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
