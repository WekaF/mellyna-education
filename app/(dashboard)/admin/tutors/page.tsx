'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, X } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/common/DataTable'

interface Tutor {
  id: string
  name: string
  email: string
  phone: string | null
  suspended: boolean
  createdAt: string
}

export default function AdminTutorsPage() {
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suspending, setSuspending] = useState<string | null>(null)

  // Edit tutor states
  const [editTutor, setEditTutor] = useState<Tutor | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [savingEdit, setSavingEdit] = useState(false)

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

  useEffect(() => {
    fetchTutors()
  }, [fetchTutors])

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

  const handleOpenEditModal = (tutor: Tutor) => {
    setEditTutor(tutor)
    setEditForm({
      name: tutor.name,
      email: tutor.email,
      phone: tutor.phone || '',
      password: '',
    })
    setError(null)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTutor) return
    setSavingEdit(true)
    setError(null)
    try {
      const res = await fetch(`/api/users/${editTutor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal mengubah data tutor.')
      }
      await fetchTutors()
      setEditTutor(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleToggleSuspend = useCallback(async (tutor: Tutor) => {
    if (!confirm(`${tutor.suspended ? 'Aktifkan kembali' : 'Tangguhkan'} akun tutor "${tutor.name}"?`)) return
    setSuspending(tutor.id)
    try {
      const res = await fetch(`/api/admin/users/${tutor.id}/suspend`, { method: 'PATCH' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal mengubah status.')
      }
      await fetchTutors()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSuspending(null)
    }
  }, [fetchTutors])

  const columns = useMemo<ColumnDef<Tutor>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Nama Tutor',
      cell: ({ getValue }) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-sm">👩‍🏫</span>
          </div>
          <span className="font-semibold text-slate-800">{getValue() as string}</span>
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ getValue }) => <span className="text-slate-600">{getValue() as string}</span>,
    },
    {
      accessorKey: 'phone',
      header: 'No. HP',
      cell: ({ getValue }) => (
        <span className="text-slate-500">{(getValue() as string | null) || '-'}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => {
        const tutor = row.original
        return tutor.suspended ? (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-600">Ditangguhkan</span>
        ) : (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Aktif</span>
        )
      },
    },
    {
      id: 'createdAt',
      accessorFn: (row) =>
        new Date(row.createdAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      header: 'Terdaftar',
      cell: ({ getValue }) => <span className="text-slate-400">{getValue() as string}</span>,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const tutor = row.original
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleToggleSuspend(tutor)}
              disabled={suspending === tutor.id}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 ${
                tutor.suspended
                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
              }`}
            >
              {suspending === tutor.id ? '...' : tutor.suspended ? '✅ Aktifkan' : '🔒 Tangguhkan'}
            </button>
            <button
              onClick={() => handleOpenEditModal(tutor)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              ✏️ Ubah
            </button>
          </div>
        )
      },
    },
  ], [handleToggleSuspend, suspending, handleOpenEditModal])

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

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">
          ⚠️ {error}
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6">
          <h2 className="font-bold text-slate-800 mb-4">Tambah Tutor Baru</h2>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="mis. Pak Budi Santoso"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="tutor@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Password *</label>
              <input
                required
                type="password"
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Min. 6 karakter"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">No. HP (WhatsApp)</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="mis. 6281234567890"
              />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Tambah Tutor'}
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
          data={tutors}
          loading={loading}
          searchPlaceholder="Cari nama tutor atau email..."
          emptyMessage="Belum ada tutor yang terdaftar."
          emptyIcon="👩‍🏫"
        />
      </div>

      {/* MODAL: EDIT TUTOR */}
      {editTutor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-indigo-150 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50/40">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                ✏️ Ubah Data Tutor
              </h3>
              <button
                onClick={() => setEditTutor(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap *</label>
                  <input
                    required
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
                  <input
                    required
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">No. HP (WhatsApp)</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="mis. 6281234567890"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Ganti Password</label>
                  <input
                    type="password"
                    minLength={6}
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Kosongkan jika tidak diganti"
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex gap-2 justify-end">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditTutor(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer"
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
