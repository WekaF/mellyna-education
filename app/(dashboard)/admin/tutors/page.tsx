'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'

interface Tutor {
  id: string
  name: string
  email: string
  phone: string | null
  createdAt: string
}

export default function AdminTutorsPage() {
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTutors = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tutors')
      setTutors(await res.json())
    } catch {
      setError('Gagal memuat data tutor.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTutors() }, [fetchTutors])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role: 'TUTOR' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal menambahkan tutor.')
      }
      await fetchTutors()
      setShowForm(false)
      setForm({ name: '', email: '', password: '', phone: '' })
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
          <h1 className="text-2xl font-extrabold text-slate-800">👩‍🏫 Data Tutor</h1>
          <p className="text-sm text-slate-500 mt-0.5">Daftar tutor yang terdaftar di Mellyna Education.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Tambah Tutor
        </button>
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">⚠️ {error}</div>}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6">
          <h2 className="font-bold text-slate-800 mb-4">Tambah Tutor Baru</h2>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500" placeholder="mis. Pak Budi Santoso" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500" placeholder="tutor@email.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Password *</label>
              <input required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500" placeholder="Min. 6 karakter" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">No. HP (WhatsApp)</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500" placeholder="mis. 6281234567890" />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Tambah Tutor'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">Batal</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center"><div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" /></div>
      ) : tutors.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 p-10 text-center text-slate-400">
          <p className="text-3xl">👩‍🏫</p>
          <p className="mt-2 text-sm font-medium">Belum ada tutor yang terdaftar.</p>
          <p className="text-xs text-slate-400 mt-1">Klik "Tambah Tutor" untuk mendaftarkan tutor baru.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tutors.map((tutor) => (
            <div key={tutor.id} className="rounded-2xl bg-white border border-slate-100 shadow-xs p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
                  <span className="text-xl">👩‍🏫</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{tutor.name}</h3>
                  <p className="text-xs text-slate-500">{tutor.email}</p>
                  {tutor.phone && <p className="text-xs text-slate-400">{tutor.phone}</p>}
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Terdaftar: {new Date(tutor.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
