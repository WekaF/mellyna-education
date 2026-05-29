'use client'

import { useState, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, MessageCircle, UserX, UserCheck } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/common/DataTable'

interface Student {
  id: string
  name: string
  grade: string | null
  createdAt: string
  parentId: string
  isActive: boolean
  parent: { name: string; email: string; phone: string | null }
}

interface StudentsClientProps {
  initialStudents: {
    id: string
    name: string
    grade: string | null
    createdAt: string
    parentId: string
    isActive: boolean
    parent: { name: string; email: string; phone: string | null }
  }[]
  parents: { id: string; name: string; email: string }[]
}

export default function StudentsClient({ initialStudents, parents: initialParents }: StudentsClientProps) {
  const [students, setStudents] = useState<Student[]>(initialStudents)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', grade: '', parentId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parents, setParents] = useState<{ id: string; name: string; email: string }[]>(initialParents)
  const [contactTarget, setContactTarget] = useState<{ parentId: string; parentName: string; phone: string | null } | null>(null)
  const [contactMessage, setContactMessage] = useState('')
  const [contactSending, setContactSending] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/students')
      setStudents(await res.json())
    } catch {
      setError('Gagal memuat data siswa.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const url = editId ? `/api/students/${editId}` : '/api/students'
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Gagal menyimpan data.')
      await fetchStudents()
      setShowForm(false)
      setEditId(null)
      setForm({ name: '', grade: '', parentId: '' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!confirm(`Hapus siswa "${name}"? Tindakan ini tidak dapat dibatalkan.`)) return
    try {
      await fetch(`/api/students/${id}`, { method: 'DELETE' })
      await fetchStudents()
    } catch {
      setError('Gagal menghapus siswa.')
    }
  }, [fetchStudents])

  const handleEditClick = useCallback((student: Student) => {
    setEditId(student.id)
    setForm({ name: student.name, grade: student.grade || '', parentId: '' })
    setShowForm(true)
  }, [])

  const handleContactWA = useCallback((student: Student) => {
    setContactTarget({ parentId: student.parentId, parentName: student.parent.name, phone: student.parent.phone })
    setContactMessage('')
    setContactError(null)
  }, [])

  const handleSendContact = async () => {
    if (!contactTarget || !contactMessage.trim()) return
    setContactSending(true)
    setContactError(null)
    try {
      const res = await fetch('/api/admin/contact-parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: contactTarget.parentId, message: contactMessage }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal mengirim pesan.')
      }
      setContactTarget(null)
      setContactMessage('')
    } catch (err: any) {
      setContactError(err.message)
    } finally {
      setContactSending(false)
    }
  }

  const handleToggleActive = useCallback(async (student: Student) => {
    setToggling(student.id)
    try {
      const res = await fetch(`/api/students/${student.id}/status`, { method: 'PATCH' })
      if (!res.ok) throw new Error()
      await fetchStudents()
    } catch {
      setError('Gagal mengubah status siswa.')
    } finally {
      setToggling(null)
    }
  }, [fetchStudents])

  const columns = useMemo<ColumnDef<Student>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Nama Siswa',
      cell: ({ getValue }) => (
        <span className="font-semibold text-slate-800">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'grade',
      header: 'Kelas',
      cell: ({ getValue }) => (
        <span className="text-slate-600">{(getValue() as string | null) || '-'}</span>
      ),
    },
    {
      id: 'parent',
      accessorFn: (row) => row.parent.name,
      header: 'Orang Tua',
      cell: ({ getValue }) => <span className="text-slate-600">{getValue() as string}</span>,
    },
    {
      id: 'createdAt',
      accessorFn: (row) => new Date(row.createdAt).toLocaleDateString('id-ID'),
      header: 'Terdaftar',
      cell: ({ getValue }) => <span className="text-slate-400">{getValue() as string}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => {
        const student = row.original
        return student.isActive ? (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Aktif</span>
        ) : (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Nonaktif</span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const student = row.original
        return (
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => handleContactWA(student)}
              className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
              title="Hubungi Orang Tua via WA"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleToggleActive(student)}
              disabled={toggling === student.id}
              className={`p-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                student.isActive
                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
              }`}
              title={student.isActive ? 'Nonaktifkan siswa' : 'Aktifkan siswa'}
            >
              {student.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
            </button>
            <button
              onClick={() => handleEditClick(student)}
              className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(student.id, student.name)}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      },
    },
  ], [handleDelete, handleEditClick, handleContactWA, handleToggleActive, toggling])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">🎓 Data Siswa</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola daftar siswa bimbingan belajar.</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true)
            setEditId(null)
            setForm({ name: '', grade: '', parentId: '' })
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Tambah Siswa
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">
          ⚠️ {error}
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6 space-y-4">
          <h2 className="font-bold text-slate-800">{editId ? 'Edit Siswa' : 'Tambah Siswa Baru'}</h2>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Siswa *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Nama lengkap siswa"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kelas / Tingkatan</label>
              <input
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="mis. Kelas 5 SD"
              />
            </div>
            {!editId && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Orang Tua *</label>
                <select
                  required
                  value={form.parentId}
                  onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="">Pilih Orang Tua</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="sm:col-span-3 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
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
          data={students}
          loading={loading}
          searchPlaceholder="Cari nama siswa atau kelas..."
          emptyMessage="Belum ada data siswa."
          emptyIcon="📭"
        />
      </div>
      {contactTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => setContactTarget(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl z-10">
            <h3 className="font-bold text-slate-800 mb-1">💬 Hubungi Orang Tua via WA</h3>
            <p className="text-xs text-slate-500 mb-4">
              Kepada: <strong>{contactTarget.parentName}</strong>
              {contactTarget.phone
                ? <span className="ml-1 text-slate-400">({contactTarget.phone})</span>
                : <span className="ml-1 text-rose-500"> — Nomor HP belum diisi</span>
              }
            </p>
            {contactError && (
              <div className="mb-3 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-xs text-rose-600">⚠️ {contactError}</div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Pesan *</label>
                <textarea
                  rows={4}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Tulis pesan untuk orang tua..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSendContact}
                  disabled={contactSending || !contactMessage.trim() || !contactTarget.phone}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl cursor-pointer transition-colors"
                >
                  {contactSending ? 'Mengirim...' : '📲 Kirim WA'}
                </button>
                <button
                  onClick={() => setContactTarget(null)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
