'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Users, Pencil, Info } from 'lucide-react'

const PROGRAMS = ['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH'] as const
type ProgramValue = typeof PROGRAMS[number]

const PROGRAM_COLORS: Record<ProgramValue, string> = {
  SEMPOA:    'bg-purple-100 text-purple-700 border border-purple-200',
  AHE:       'bg-amber-100 text-amber-700 border border-amber-200',
  EFK:       'bg-teal-100 text-teal-700 border border-teal-200',
  EYL:       'bg-pink-100 text-pink-700 border border-pink-200',
  EFE:       'bg-rose-100 text-rose-700 border border-rose-200',
  CALISTUNG: 'bg-green-100 text-green-700 border border-green-200',
  ENGLISH:   'bg-blue-100 text-blue-700 border border-blue-200',
}

interface ClassProgram { program: ProgramValue }

interface Class {
  id: string
  name: string
  programs: ClassProgram[]
  description: string | null
  tutor: { name: string; email: string }
  _count: { enrollments: number }
  enrollments?: Array<{ id: string; student: { id: string; name: string; grade: string | null } }>
}

function ProgramBadge({ program }: { program: ProgramValue }) {
  return (
    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${PROGRAM_COLORS[program] ?? 'bg-slate-100 text-slate-700'}`}>
      {program}
    </span>
  )
}

function ProgramToggle({
  selected,
  onChange,
}: {
  selected: ProgramValue[]
  onChange: (p: ProgramValue[]) => void
}) {
  const toggle = (p: ProgramValue) => {
    onChange(selected.includes(p) ? selected.filter(x => x !== p) : [...selected, p])
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {PROGRAMS.map(p => (
        <button
          key={p}
          type="button"
          onClick={() => toggle(p)}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
            selected.includes(p)
              ? `${PROGRAM_COLORS[p]} shadow-sm`
              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

const makeEmptyForm = () => ({ name: '', programs: [] as ProgramValue[], description: '', tutorId: '' })

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(makeEmptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tutors, setTutors] = useState<any[]>([])

  const [editClass, setEditClass] = useState<Class | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editForm, setEditForm] = useState(makeEmptyForm)
  const [editSaving, setEditSaving] = useState(false)

  const [enrollClass, setEnrollClass] = useState<Class | null>(null)
  const [enrollStudentId, setEnrollStudentId] = useState('')
  const [enrollSaving, setEnrollSaving] = useState(false)
  const [allStudents, setAllStudents] = useState<{ id: string; name: string; grade: string | null }[]>([])

  const fetchClasses = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/classes')
      if (!res.ok) throw new Error('Gagal memuat data kelas.')
      setClasses(await res.json())
    } catch {
      setError('Gagal memuat data kelas.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTutors = useCallback(async () => {
    try {
      const res = await fetch('/api/tutors')
      if (!res.ok) return
      setTutors(await res.json())
    } catch {}
  }, [])

  const fetchAllStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/students')
      if (!res.ok) return
      setAllStudents(await res.json())
    } catch {}
  }, [])

  useEffect(() => {
    fetchClasses()
    fetchTutors()
    fetchAllStudents()
  }, [fetchClasses, fetchTutors, fetchAllStudents])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.programs.length === 0) { setError('Pilih minimal 1 program.'); return }
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
      setForm(makeEmptyForm())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editClass) return
    if (editForm.programs.length === 0) { setError('Pilih minimal 1 program.'); return }
    setEditSaving(true)
    setError(null)
    try {
      const payload: { name: string; programs: ProgramValue[]; description: string; tutorId?: string } = {
        name: editForm.name,
        programs: editForm.programs,
        description: editForm.description,
        ...(editForm.tutorId ? { tutorId: editForm.tutorId } : {}),
      }
      const res = await fetch(`/api/classes/${editClass.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Gagal menyimpan perubahan.')
      await fetchClasses()
      setShowEditForm(false)
      setEditClass(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setEditSaving(false)
    }
  }

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!enrollClass || !enrollStudentId) return
    setEnrollSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: enrollStudentId, classId: enrollClass.id }),
      })
      if (!res.ok) throw new Error('Gagal mendaftarkan siswa.')
      const refetchRes = await fetch('/api/classes')
      const updatedClasses = await refetchRes.json()
      setClasses(updatedClasses)
      const refreshed = updatedClasses.find((c: Class) => c.id === enrollClass.id)
      if (refreshed) setEnrollClass(refreshed)
      setEnrollStudentId('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setEnrollSaving(false)
    }
  }

  const handleUnenroll = async (enrollmentId: string) => {
    if (!confirm('Keluarkan siswa dari kelas ini?')) return
    try {
      const delRes = await fetch(`/api/enrollments/${enrollmentId}`, { method: 'DELETE' })
      if (!delRes.ok) throw new Error('Gagal mengeluarkan siswa.')
      const refetchRes = await fetch('/api/classes')
      const updatedClasses = await refetchRes.json()
      setClasses(updatedClasses)
      if (enrollClass) {
        const refreshed = updatedClasses.find((c: Class) => c.id === enrollClass.id)
        if (refreshed) setEnrollClass(refreshed)
      }
    } catch {
      setError('Gagal mengeluarkan siswa.')
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

      {/* Program info box */}
      <div className="flex gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
        <div>
          <span className="font-bold">Catatan Program: </span>
          Setiap kelas bisa terdiri dari beberapa program. Contoh: kelas dengan program <span className="font-bold">AHE + SEMPOA + EFK</span> berarti siswa di kelas ini mengikuti 3 program sekaligus — bukan satu mata pelajaran gabungan.
        </div>
      </div>

      {error && <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-600">⚠️ {error}</div>}

      {showForm && (
        <div className="rounded-2xl bg-white border border-indigo-100 shadow-md p-6 space-y-4">
          <div>
            <h2 className="font-bold text-slate-800">Tambah Kelas Baru</h2>
            <p className="text-xs text-slate-400 mt-0.5">Jadwal (hari & jam) diatur di halaman Timetable.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Kelas *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="mis. Sempoa Kelompok A"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tutor *</label>
                <select
                  required
                  value={form.tutorId}
                  onChange={(e) => setForm({ ...form, tutorId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="">Pilih Tutor</option>
                  {tutors.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Program * <span className="font-normal text-slate-400">(pilih semua yang relevan)</span></label>
              <ProgramToggle selected={form.programs} onChange={(p) => setForm({ ...form, programs: p })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Deskripsi</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Deskripsi singkat (opsional)"
              />
            </div>
            <div className="flex gap-3">
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
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {cls.programs.map(({ program }) => (
                        <ProgramBadge key={program} program={program} />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditClass(cls)
                      setEditForm({
                        name: cls.name,
                        programs: cls.programs.map(p => p.program),
                        description: cls.description || '',
                        tutorId: '',
                      })
                      setShowEditForm(true)
                    }}
                    className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-500">{cls.description || 'Tidak ada deskripsi.'}</p>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Users className="h-3.5 w-3.5" />
                    <span>{cls._count.enrollments} Siswa</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEnrollClass(cls)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
                    >
                      Kelola Siswa
                    </button>
                    <span className="text-xs text-slate-600 font-medium">Tutor: {cls.tutor.name}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Edit Class Modal */}
      {showEditForm && editClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => setShowEditForm(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl z-10">
            <h2 className="font-bold text-slate-800 mb-4">Edit Kelas: {editClass.name}</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Kelas *</label>
                  <input
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="mis. Sempoa Kelompok A"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Ganti Tutor (opsional)</label>
                  <select
                    value={editForm.tutorId}
                    onChange={(e) => setEditForm({ ...editForm, tutorId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="">Biarkan tutor saat ini ({editClass.tutor.name})</option>
                    {tutors.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Program * <span className="font-normal text-slate-400">(pilih semua yang relevan)</span></label>
                <ProgramToggle selected={editForm.programs} onChange={(p) => setEditForm({ ...editForm, programs: p })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Deskripsi</label>
                <input
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Deskripsi singkat (opsional)"
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={editSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
                  {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
                <button type="button" onClick={() => setShowEditForm(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enrollment Management Modal */}
      {enrollClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => setEnrollClass(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl z-10 max-h-[80vh] overflow-y-auto">
            <h2 className="font-bold text-slate-800 mb-1">Kelola Siswa: {enrollClass.name}</h2>
            <div className="flex flex-wrap gap-1 mb-3">
              {enrollClass.programs.map(({ program }) => (
                <ProgramBadge key={program} program={program} />
              ))}
            </div>
            <p className="text-xs text-slate-500 mb-4">{enrollClass._count.enrollments} siswa terdaftar</p>

            <div className="space-y-2 mb-5">
              {(enrollClass.enrollments ?? []).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Belum ada siswa terdaftar.</p>
              ) : (
                (enrollClass.enrollments ?? []).map(({ id: enrollId, student }) => (
                  <div key={enrollId} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{student.name}</p>
                      <p className="text-xs text-slate-400">{student.grade || 'Kelas tidak diketahui'}</p>
                    </div>
                    <button
                      onClick={() => handleUnenroll(enrollId)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                    >
                      Keluarkan
                    </button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleEnrollSubmit} className="flex gap-3 border-t border-slate-100 pt-4">
              <select
                required
                value={enrollStudentId}
                onChange={(e) => setEnrollStudentId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
              >
                <option value="">Tambah siswa ke kelas ini...</option>
                {allStudents
                  .filter((s) => !(enrollClass.enrollments ?? []).some((e) => e.student.id === s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{s.grade ? ` (${s.grade})` : ''}</option>
                  ))}
              </select>
              <button type="submit" disabled={enrollSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50">
                {enrollSaving ? '...' : 'Daftarkan'}
              </button>
            </form>

            <button
              onClick={() => setEnrollClass(null)}
              className="mt-3 w-full text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
