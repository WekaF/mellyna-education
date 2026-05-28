'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Users, Pencil } from 'lucide-react'

interface Class {
  id: string
  name: string
  subject: string
  description: string | null
  tutor: { name: string; email: string }
  _count: { enrollments: number }
}

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', subject: '', description: '', tutorId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchClasses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/classes')
      setClasses(await res.json())
    } catch {
      setError('Gagal memuat data kelas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchClasses() }, [fetchClasses])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Gagal menyimpan kelas.')
      await fetchClasses()
      setShowForm(false)
      setForm({ name: '', subject: '', description: '', tutorId: '' })
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
          <h1 className="text-2xl font-extrabold text-slate-800">🏫 Data Kelas & Tutor</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola kelas bimbingan belajar dan penugasan tutor.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Buat Kelas Baru
        </button>
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">⚠️ {error}</div>}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6 space-y-4">
          <h2 className="font-bold text-slate-800">Tambah Kelas Baru</h2>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            {[
              { label: 'Nama Kelas *', key: 'name', placeholder: 'mis. Matematika Dasar' },
              { label: 'Mata Pelajaran *', key: 'subject', placeholder: 'mis. Matematika' },
              { label: 'Deskripsi', key: 'description', placeholder: 'Deskripsi singkat kelas' },
              { label: 'ID Tutor *', key: 'tutorId', placeholder: 'User ID tutor' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                <input
                  required={label.includes('*')}
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder={placeholder}
                />
              </div>
            ))}
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan Kelas'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer">Batal</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.length === 0 ? (
            <div className="col-span-full rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
              <p className="text-3xl">📚</p>
              <p className="mt-2 font-medium text-sm">Belum ada kelas yang dibuat.</p>
            </div>
          ) : (
            classes.map((cls) => (
              <div key={cls.id} className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 flex flex-col gap-3 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800">{cls.name}</h3>
                    <span className="inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{cls.subject}</span>
                  </div>
                  <button className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-500">{cls.description || 'Tidak ada deskripsi.'}</p>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Users className="h-3.5 w-3.5" />
                    <span>{cls._count.enrollments} Siswa</span>
                  </div>
                  <span className="text-xs text-slate-600 font-medium">Tutor: {cls.tutor.name}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
