'use client'

import { useState, useCallback } from 'react'
import { Program } from '@prisma/client'
import { Plus, Pencil, Trash2, BookMarked } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useToastNotification } from '@/lib/hooks/use-toast-notification'

type Milestone = {
  id: string
  name: string
  description: string | null
  program: Program
  order: number
}

const PROGRAMS: Program[] = ['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH']

const PROGRAM_LABELS: Record<Program, string> = {
  SEMPOA: 'Sempoa',
  AHE: 'AHE',
  EFK: 'EFK',
  EYL: 'EYL',
  EFE: 'EFE',
  CALISTUNG: 'Calistung',
  ENGLISH: 'English',
}

const PROGRAM_COLORS: Record<Program, string> = {
  SEMPOA: 'from-indigo-500 to-indigo-600',
  AHE: 'from-emerald-500 to-emerald-600',
  EFK: 'from-amber-500 to-amber-600',
  EYL: 'from-rose-500 to-rose-600',
  EFE: 'from-cyan-500 to-cyan-600',
  CALISTUNG: 'from-violet-500 to-violet-600',
  ENGLISH: 'from-orange-500 to-orange-600',
}

export default function MilestonesClient({ initialMilestones }: { initialMilestones: Milestone[] }) {
  const router = useRouter()
  const confirm = useConfirm()
  const toast = useToastNotification()
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones)
  const [activeProgram, setActiveProgram] = useState<Program>('SEMPOA')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Milestone | null>(null)
  const [form, setForm] = useState({ name: '', description: '', program: 'SEMPOA' as Program, order: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = milestones.filter((m) => m.program === activeProgram)

  const openCreate = () => {
    setEditTarget(null)
    setForm({ name: '', description: '', program: activeProgram, order: filtered.length })
    setError('')
    setShowForm(true)
  }

  const openEdit = (m: Milestone) => {
    setEditTarget(m)
    setForm({ name: m.name, description: m.description ?? '', program: m.program, order: m.order })
    setError('')
    setShowForm(true)
  }

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) { setError('Nama milestone wajib diisi'); return }
    setLoading(true)
    setError('')
    try {
      if (editTarget) {
        const res = await fetch(`/api/milestones/${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Gagal memperbarui milestone')
        const updated: Milestone = await res.json()
        setMilestones((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
      } else {
        const res = await fetch('/api/milestones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Gagal membuat milestone')
        const created: Milestone = await res.json()
        setMilestones((prev) => [...prev, created])
      }
      setShowForm(false)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [form, editTarget, router])

  const handleDelete = useCallback(async (id: string) => {
    const ok = await confirm({
      title: 'Hapus Milestone',
      message: 'Hapus milestone ini?',
      detail: 'Data progress siswa yang terhubung juga akan terhapus.',
      variant: 'danger',
      confirmLabel: 'Hapus Milestone',
    })
    if (!ok) return
    setLoading(true)
    try {
      const res = await fetch(`/api/milestones/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus milestone')
      setMilestones((prev) => prev.filter((m) => m.id !== id))
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [confirm, toast])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-700 p-5 sm:p-8 text-white shadow-xl shadow-violet-600/10">
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">Milestone Kurikulum</h1>
        <p className="mt-2 text-sm sm:text-base text-violet-100">
          Kelola pencapaian kurikulum per program sebagai acuan perkembangan siswa.
        </p>
      </div>

      {/* Program Tabs */}
      <div className="flex flex-wrap gap-2">
        {PROGRAMS.map((p) => {
          const count = milestones.filter((m) => m.program === p).length
          return (
            <button
              key={p}
              onClick={() => setActiveProgram(p)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                activeProgram === p
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
              }`}
            >
              {PROGRAM_LABELS[p]}
              <span className="ml-2 text-xs opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Milestone List */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${PROGRAM_COLORS[activeProgram]} text-white`}>
              <BookMarked className="h-4 w-4" />
            </div>
            <h2 className="font-bold text-slate-800 dark:text-white">
              {PROGRAM_LABELS[activeProgram]} — {filtered.length} Milestone
            </h2>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
          >
            <Plus className="h-4 w-4" />
            Tambah Milestone
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400">
            <p className="text-3xl">🎯</p>
            <p className="mt-2 text-sm">Belum ada milestone untuk program ini.</p>
            <button onClick={openCreate} className="mt-4 text-indigo-600 text-sm font-semibold hover:underline">
              Tambah milestone pertama →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((m, idx) => (
              <div key={m.id} className="flex items-start justify-between px-6 py-4 gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-white text-sm">{m.name}</p>
                    {m.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{m.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(m)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(m.id)}
                    disabled={loading}
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

      {/* Link to student progress */}
      <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-bold text-indigo-800 dark:text-indigo-300 text-sm">Lihat Progress Siswa</p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
            Pantau dan perbarui pencapaian milestone per siswa.
          </p>
        </div>
        <a
          href="/admin/milestones/progress"
          className="shrink-0 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
        >
          Progress Siswa →
        </a>
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-5">
            <h3 className="font-extrabold text-slate-800 dark:text-white">
              {editTarget ? 'Edit Milestone' : 'Tambah Milestone Baru'}
            </h3>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-600">{error}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Program</label>
                <select
                  value={form.program}
                  onChange={(e) => setForm({ ...form, program: e.target.value as Program })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PROGRAMS.map((p) => (
                    <option key={p} value={p}>{PROGRAM_LABELS[p]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nama Milestone *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="contoh: Mampu berhitung 1-10 dengan sempoa"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deskripsi (opsional)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Jelaskan kriteria pencapaian milestone ini..."
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Urutan</label>
                <input
                  type="number"
                  min={0}
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : editTarget ? 'Simpan Perubahan' : 'Tambah Milestone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
